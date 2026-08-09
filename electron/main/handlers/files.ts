import { ipcMain, dialog, shell, app, nativeImage } from 'electron'
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

  /**
   * A tile is 72px. Sending the original back as base64 to paint it meant a 5MB
   * receipt crossing IPC as a ~6.7MB string and sitting in renderer state for as
   * long as the sheet was open. This hands back a 144px copy (2x for hidpi)
   * instead. Formats nativeImage can't decode fall back to the original.
   */
  ipcMain.handle('files:getThumbnail', (_, filePath: string, size = 144): string | null => {
    if (!filePath || !fs.existsSync(filePath)) return null
    const image = nativeImage.createFromPath(filePath)
    if (image.isEmpty()) return null
    const { width, height } = image.getSize()
    const longest = Math.max(width, height)
    const scaled = longest > size
      ? image.resize(width >= height ? { width: size } : { height: size })
      : image
    return scaled.toDataURL()
  })

  ipcMain.handle('files:openFile', async (_, filePath: string) => {
    await shell.openPath(filePath)
  })
}
