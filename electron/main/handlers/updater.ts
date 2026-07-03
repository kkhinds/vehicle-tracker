import { ipcMain } from 'electron'
import { checkForUpdates, installUpdate, getUpdaterStatus } from '../updater'

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', () => checkForUpdates())
  ipcMain.handle('updater:install', () => installUpdate())
  ipcMain.handle('updater:getStatus', () => getUpdaterStatus())
}
