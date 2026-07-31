import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDb } from './db'
import { registerFuelHandlers } from './handlers/fuel'
import { registerMaintenanceHandlers } from './handlers/maintenance'
import { registerScheduleHandlers } from './handlers/schedule'
import { registerInsuranceHandlers } from './handlers/insurance'
import { registerNotesHandlers } from './handlers/notes'
import { registerSettingsHandlers } from './handlers/settings'
import { registerFilesHandlers } from './handlers/files'
import { registerDashboardHandlers } from './handlers/dashboard'
import { registerExpensesHandlers } from './handlers/expenses'
import { registerVehicleHandlers } from './handlers/vehicles'
import { registerTireHandlers } from './handlers/tires'
import { registerDocumentHandlers } from './handlers/documents'
import { registerNotificationHandlers, startNotificationScheduler } from './notifications'
import { registerBackupHandlers } from './handlers/backup'
import { runStartupBackup } from './backups'
import { registerFluidHandlers } from './handlers/fluids'
import { registerUpdaterHandlers } from './handlers/updater'
import { registerTimelineHandlers } from './handlers/timeline'
import { registerFuelPriceHandlers, refreshPumpPricesIfStale } from './fuelPrices'
import { initAutoUpdater } from './updater'

// Resolve a resource shipped under /resources at both dev and production paths.
// Dev:  <project>/resources/foo
// Prod: depending on packaging, either inside the asar (app.getAppPath()) or
//       alongside it via extraResources (process.resourcesPath/...).
function resolveResource(name: string): string {
  const candidates = [
    path.join(app.getAppPath(), 'resources', name),
    path.join(process.resourcesPath, name),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }
  return candidates[0]
}

/**
 * A dev build gets its own icon, window title and taskbar identity so it is
 * obvious at a glance which one is running — the packaged app and `npm run dev`
 * otherwise look identical and share a taskbar group.
 */
const IS_DEV = !app.isPackaged
const APP_ICON = () => resolveResource(IS_DEV ? 'icon-dev.ico' : 'icon.ico')
const WINDOW_TITLE = IS_DEV ? 'Vehicle Tracker — DEV' : 'Vehicle Tracker'

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let splashShownAt = 0
const MIN_SPLASH_MS = 3000  // splash stays visible at least this long, even on a fast launch

function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    skipTaskbar: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  splashWindow.once('ready-to-show', () => {
    splashWindow?.show()
    splashShownAt = Date.now()
  })
  splashWindow.loadFile(resolveResource('splash.html'), IS_DEV ? { query: { dev: '1' } } : undefined)
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: APP_ICON(),
    title: WINDOW_TITLE,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#0A0E14',
    show: false,
    frame: true,
    titleBarStyle: 'default',
    // No File/Edit/View menu bar — the app navigates entirely through its own UI.
    // autoHideMenuBar stays false so Alt doesn't reveal the hidden bar.
    autoHideMenuBar: false,
  })
  mainWindow.setMenuBarVisibility(false)
  // The renderer's <title> would overwrite the window title a moment after load.
  mainWindow.on('page-title-updated', e => { e.preventDefault() })

  mainWindow.once('ready-to-show', () => {
    // Keep the splash on screen for at least MIN_SPLASH_MS, even if the
    // main window is ready sooner. On a slow launch (DB migration, large
    // backup, etc.) this is a no-op — the splash was already visible
    // longer than the minimum.
    const elapsed = splashShownAt > 0 ? Date.now() - splashShownAt : 0
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed)
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }
      mainWindow?.show()
    }, remaining)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })


  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Tell Windows this is its own app — otherwise the taskbar groups it
  // under "Electron" and uses the generic Electron icon, no matter what
  // we set on the BrowserWindow. Must match build.appId in package.json.
  if (process.platform === 'win32') {
    // Distinct id in dev, so the two builds don't share a taskbar button.
    app.setAppUserModelId(IS_DEV ? 'com.kemarhinds.vehicletracker.dev' : 'com.kemarhinds.vehicletracker')
  }

  // No visible menu bar, but the menu itself is kept so its accelerators keep
  // working — reload, dev tools, zoom and clipboard all hang off these roles.
  // (Setting the menu to null would take the shortcuts with it.) The bar is
  // hidden per-window below; with autoHideMenuBar off, Alt can't summon it back.
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]))

  // Show the splash IMMEDIATELY — before any DB or handler initialization —
  // so the user sees feedback that the app is starting.
  createSplashWindow()

  await initDb()

  // Auto-backup on startup (idempotent — skips if a backup already exists
  // for the current frequency bucket).
  runStartupBackup()

  registerVehicleHandlers()
  registerFuelHandlers()
  registerMaintenanceHandlers()
  registerScheduleHandlers()
  registerInsuranceHandlers()
  registerNotesHandlers()
  registerSettingsHandlers()
  registerFilesHandlers()
  registerDashboardHandlers()
  registerExpensesHandlers()
  registerTireHandlers()
  registerDocumentHandlers()
  registerNotificationHandlers()
  registerBackupHandlers()
  registerFluidHandlers()
  registerUpdaterHandlers()
  registerTimelineHandlers()
  registerFuelPriceHandlers()
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // National pump prices, for cross-checking what gets typed in. Fire and
  // forget: it's a nicety, and the app is fully usable offline without it.
  void refreshPumpPricesIfStale()

  createMainWindow()
  startNotificationScheduler()
  if (mainWindow) initAutoUpdater(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
