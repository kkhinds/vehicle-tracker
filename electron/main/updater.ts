import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdaterPhase =
  | 'idle' | 'checking' | 'available' | 'not-available'
  | 'downloading' | 'downloaded' | 'error'

export interface UpdaterStatus {
  phase: UpdaterPhase
  currentVersion: string
  version?: string
  percent?: number
  error?: string
}

let mainWindow: BrowserWindow | null = null
let status: UpdaterStatus = { phase: 'idle', currentVersion: app.getVersion() }

function setStatus(partial: Partial<UpdaterStatus>): void {
  status = { ...status, ...partial }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', status)
  }
}

/**
 * Wire up event listeners and kick off a startup check. electron-updater
 * reads app-update.yml from the packaged app's resources, which only exists
 * after an electron-builder build — it's a no-op in dev (`electron .`).
 */
export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true

  // Every terminal-success transition also clears `error`/`percent` so a prior
  // failure or finished download can't leave a stale value on the status.
  autoUpdater.on('checking-for-update', () => setStatus({ phase: 'checking', error: undefined, percent: undefined }))
  autoUpdater.on('update-available', (info) => setStatus({ phase: 'available', version: info.version, error: undefined }))
  autoUpdater.on('update-not-available', () => setStatus({ phase: 'not-available', error: undefined, percent: undefined }))
  autoUpdater.on('download-progress', (progress) => setStatus({ phase: 'downloading', percent: progress.percent }))
  autoUpdater.on('update-downloaded', (info) => setStatus({ phase: 'downloaded', version: info.version, percent: undefined, error: undefined }))
  autoUpdater.on('error', (err) => setStatus({ phase: 'error', error: err.message, percent: undefined }))

  // A few seconds after launch so the check doesn't compete with initial load.
  setTimeout(() => { void autoUpdater.checkForUpdates().catch(() => { /* surfaced via 'error' event */ }) }, 5000)
}

export async function checkForUpdates(): Promise<UpdaterStatus> {
  if (!app.isPackaged) {
    setStatus({ phase: 'not-available', error: 'Updates only work in the installed app, not this dev build.' })
    return status
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch {
    // surfaced via the 'error' event listener
  }
  return status
}

export function installUpdate(): void {
  // Only restart-to-install once an update is actually downloaded — otherwise
  // quitAndInstall() would just quit the app with nothing to install.
  if (status.phase !== 'downloaded') return
  autoUpdater.quitAndInstall()
}

export function getUpdaterStatus(): UpdaterStatus {
  return status
}
