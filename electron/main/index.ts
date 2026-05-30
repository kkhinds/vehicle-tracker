import { app, BrowserWindow, shell, protocol } from 'electron'
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

protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

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

let splashWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null

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
  splashWindow.once('ready-to-show', () => splashWindow?.show())
  splashWindow.loadFile(resolveResource('splash.html'))
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: resolveResource('icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    backgroundColor: '#0f172a',
    show: false,
    frame: true,
    titleBarStyle: 'default'
  })

  mainWindow.once('ready-to-show', () => {
    // Tiny delay so the splash gets at least one frame of "loading"
    // even on a fast machine — feels intentional rather than flickery.
    setTimeout(() => {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close()
        splashWindow = null
      }
      mainWindow?.show()
    }, 250)
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
    app.setAppUserModelId('com.kemarhinds.vehicletracker')
  }

  // Show the splash IMMEDIATELY — before any DB or handler initialization —
  // so the user sees feedback that the app is starting.
  createSplashWindow()

  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''))
    return new Response(fs.readFileSync(filePath), {
      headers: { 'Content-Type': getContentType(filePath) }
    })
  })

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

  createMainWindow()
  startNotificationScheduler()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf'
  }
  return map[ext] ?? 'application/octet-stream'
}
