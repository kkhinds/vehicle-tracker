import { ipcMain, dialog, shell, app } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

function getPhotosDir(category: string): string {
  const dir = path.join(app.getPath('userData'), 'photos', category)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function registerFilesHandlers(): void {
  ipcMain.handle('files:openDialog', async (_, options: { filters?: Array<{ name: string; extensions: string[] }>; multiple?: boolean }) => {
    const result = await dialog.showOpenDialog({
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: options.filters ?? [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    return result.filePaths
  })

  ipcMain.handle('files:savePhoto', async (_, sourcePath: string, category: string) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error('That file no longer exists — it may have been moved, deleted, or on a drive that was ejected.')
    }
    const ext = path.extname(sourcePath)
    const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`
    const destDir = getPhotosDir(category)
    const destPath = path.join(destDir, name)
    fs.copyFileSync(sourcePath, destPath)
    return destPath
  })

  ipcMain.handle('files:deleteFile', (_, filePath: string) => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  })

  ipcMain.handle('files:getImageData', (_, filePath: string): string | null => {
    if (!filePath || !fs.existsSync(filePath)) return null
    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).slice(1).toLowerCase()
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf',
    }
    const mime = mimeMap[ext] ?? 'application/octet-stream'
    return `data:${mime};base64,${buffer.toString('base64')}`
  })

  ipcMain.handle('files:openFile', async (_, filePath: string) => {
    await shell.openPath(filePath)
  })
}
