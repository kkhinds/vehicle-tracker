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

protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
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

  mainWindow.once('ready-to-show', () => mainWindow.show())

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
  // Serve local files via custom protocol
  protocol.handle('localfile', (request) => {
    const filePath = decodeURIComponent(request.url.replace('localfile://', ''))
    return new Response(fs.readFileSync(filePath), {
      headers: { 'Content-Type': getContentType(filePath) }
    })
  })

  await initDb()

  registerFuelHandlers()
  registerMaintenanceHandlers()
  registerScheduleHandlers()
  registerInsuranceHandlers()
  registerNotesHandlers()
  registerSettingsHandlers()
  registerFilesHandlers()
  registerDashboardHandlers()
  registerExpensesHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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
