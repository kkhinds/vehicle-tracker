import { ipcMain, app } from 'electron'
import {
  getBackupStatus, setBackupSettings, createBackup, exportBackup,
  pickRestoreFile, restoreFromFile, deleteBackup, openBackupsFolder,
} from '../backups'

export function registerBackupHandlers(): void {
  ipcMain.handle('backup:getStatus', () => getBackupStatus())

  ipcMain.handle('backup:updateSettings', (_, partial) => {
    setBackupSettings(partial)
    return getBackupStatus()
  })

  ipcMain.handle('backup:createNow', () => createBackup())

  ipcMain.handle('backup:export', () => exportBackup())

  /**
   * Restore flow. Two-step so the user picks the file, then we confirm
   * and replace + relaunch. The renderer is responsible for showing a
   * "this will restart the app" confirmation before invoking ':restore'.
   */
  ipcMain.handle('backup:pickRestoreFile', () => pickRestoreFile())

  ipcMain.handle('backup:restore', (_, filePath: string) => {
    restoreFromFile(filePath)
    // Relaunch so the new DB is loaded fresh (sql.js holds DB in memory).
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('backup:delete', (_, filePath: string) => {
    deleteBackup(filePath)
    return getBackupStatus()
  })

  ipcMain.handle('backup:openFolder', () => openBackupsFolder())
}
