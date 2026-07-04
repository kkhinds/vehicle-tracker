import { app, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDb } from './db'

// ─── Paths ────────────────────────────────────────────────────────────────
const USER_DATA = app.getPath('userData')
const DB_FILE = path.join(USER_DATA, 'dmax-tracker.db')
const DEFAULT_BACKUPS_DIR = path.join(USER_DATA, 'backups')
const BACKUP_PREFIX = 'vehicle-tracker'

function getBackupsDir(): string {
  return readSetting('backup_dir') || DEFAULT_BACKUPS_DIR
}

// ─── Settings keys + defaults ─────────────────────────────────────────────
type BackupFrequency = 'on_open' | 'daily' | 'weekly' | 'manual'

interface BackupSettings {
  enabled: boolean
  frequency: BackupFrequency
  retention: number   // keep last N
}

const DEFAULTS: BackupSettings = {
  enabled: true,
  frequency: 'daily',
  retention: 10,
}

interface SettingRow { value: string }

function readSetting(key: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as SettingRow | undefined
  return row?.value ?? null
}

function writeSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value)
}

export function getBackupSettings(): BackupSettings {
  return {
    enabled: (readSetting('backup_enabled') ?? String(DEFAULTS.enabled)) === 'true',
    frequency: ((readSetting('backup_frequency') ?? DEFAULTS.frequency) as BackupFrequency),
    retention: parseInt(readSetting('backup_retention') ?? String(DEFAULTS.retention), 10) || DEFAULTS.retention,
  }
}

export function setBackupSettings(partial: Partial<BackupSettings>): void {
  if (partial.enabled !== undefined) writeSetting('backup_enabled', String(partial.enabled))
  if (partial.frequency !== undefined) writeSetting('backup_frequency', partial.frequency)
  if (partial.retention !== undefined) writeSetting('backup_retention', String(partial.retention))
}

// ─── Filesystem helpers ───────────────────────────────────────────────────
function ensureBackupsDir(dir = getBackupsDir()): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function makeBackupFilename(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${BACKUP_PREFIX}-${stamp}.db`
}

export interface BackupFile {
  name: string
  path: string
  size: number
  createdAt: string  // ISO
}

export function listBackups(): BackupFile[] {
  const dir = getBackupsDir()
  ensureBackupsDir(dir)
  return fs.readdirSync(dir)
    .filter(name => name.startsWith(BACKUP_PREFIX) && name.endsWith('.db'))
    .map(name => {
      const fullPath = path.join(dir, name)
      const stat = fs.statSync(fullPath)
      return {
        name,
        path: fullPath,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function pruneOldBackups(retain: number): number {
  // Only automatic/manual dated backups count toward retention. Pre-restore
  // safety snapshots are kept out of the rotation so a few restores can't push
  // genuine dated backups past the cutoff and delete them.
  const backups = listBackups().filter(b => !b.name.includes('pre-restore'))
  let removed = 0
  for (const b of backups.slice(retain)) {
    try { fs.unlinkSync(b.path); removed++ } catch { /* ignore */ }
  }
  return removed
}

// ─── Decide whether to run an auto-backup ────────────────────────────────
function lastBackup(): BackupFile | null {
  const list = listBackups()
  return list[0] ?? null
}

function bucketKey(d: Date, frequency: BackupFrequency): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  switch (frequency) {
    case 'daily': return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    case 'weekly': {
      // ISO week number — keeps Sunday and Monday in the same bucket
      const onejan = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
      return `${d.getFullYear()}-W${pad(week)}`
    }
    case 'on_open':
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
    case 'manual':
    default:
      return 'manual-only'
  }
}

function isBackupDue(settings: BackupSettings): boolean {
  if (!settings.enabled) return false
  if (settings.frequency === 'manual') return false

  const last = lastBackup()
  if (!last) return true   // first ever

  const now = new Date()
  const lastDate = new Date(last.createdAt)
  return bucketKey(now, settings.frequency) !== bucketKey(lastDate, settings.frequency)
}

// ─── Core operations ─────────────────────────────────────────────────────
/**
 * Create a backup *now*. Copies the live DB file to the backups directory
 * with a timestamped name. Returns the file metadata.
 */
export function createBackup(): BackupFile {
  const dir = getBackupsDir()
  ensureBackupsDir(dir)
  // Persist any pending writes before copying. The db module persists on
  // every run() call so the file on disk is already up to date — but if
  // we're in the middle of a transaction we don't want to copy a partial.
  // sql.js writes synchronously after each commit; this is a no-op safeguard.

  if (!fs.existsSync(DB_FILE)) {
    throw new Error('No database file exists yet to back up.')
  }

  const filename = makeBackupFilename()
  const dest = path.join(dir, filename)
  fs.copyFileSync(DB_FILE, dest)

  // Prune after a successful backup.
  const settings = getBackupSettings()
  pruneOldBackups(Math.max(1, settings.retention))

  const stat = fs.statSync(dest)
  return {
    name: filename,
    path: dest,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  }
}

/**
 * Replace the live DB with a backup file. The app must restart afterwards —
 * sql.js holds the entire DB in memory and won't pick up the new file
 * otherwise. Caller is responsible for triggering app.relaunch().
 */
export function restoreFromFile(sourcePath: string): void {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found: ${sourcePath}`)
  }

  // Before clobbering, snapshot the current DB so the user can roll back.
  if (fs.existsSync(DB_FILE)) {
    const dir = getBackupsDir()
    ensureBackupsDir(dir)
    const safety = path.join(dir, `${BACKUP_PREFIX}-pre-restore-${Date.now()}.db`)
    fs.copyFileSync(DB_FILE, safety)
  }

  fs.copyFileSync(sourcePath, DB_FILE)
}

export function deleteBackup(filePath: string): void {
  // Guard: only allow deletions inside our backups directory. Use path.relative
  // rather than a startsWith(root + sep) prefix check so a trailing separator or
  // (on Windows) a drive-letter-casing difference can't reject a legitimate file.
  const resolved = path.resolve(filePath)
  const root = path.resolve(getBackupsDir())
  const rel = path.relative(root, resolved)
  const outside = rel === '' || rel.startsWith('..') || path.isAbsolute(rel)
  if (outside) {
    throw new Error('Refusing to delete a file outside the backups directory.')
  }
  fs.unlinkSync(resolved)
}

export async function exportBackup(): Promise<string | null> {
  const defaultName = makeBackupFilename()
  const result = await dialog.showSaveDialog({
    title: 'Export Vehicle Tracker backup',
    defaultPath: defaultName,
    filters: [{ name: 'Database file', extensions: ['db'] }],
  })
  if (result.canceled || !result.filePath) return null
  fs.copyFileSync(DB_FILE, result.filePath)
  return result.filePath
}

export async function pickRestoreFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Restore Vehicle Tracker from backup',
    defaultPath: getBackupsDir(),
    properties: ['openFile'],
    filters: [{ name: 'Database file', extensions: ['db'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function openBackupsFolder(): void {
  const dir = getBackupsDir()
  ensureBackupsDir(dir)
  void shell.openPath(dir)
}

/**
 * Let the user pick a new folder for backups. Existing backup files are
 * moved (not copied) from the old location into the new one so nothing is
 * stranded behind. Cross-drive moves fall back to copy+delete since
 * fs.renameSync can't cross volumes on Windows.
 */
export async function chooseBackupsDir(): Promise<{ dir: string; moved: number } | null> {
  const previousDir = getBackupsDir()
  const result = await dialog.showOpenDialog({
    title: 'Choose a folder for Vehicle Tracker backups',
    defaultPath: previousDir,
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const nextDir = result.filePaths[0]
  if (path.resolve(nextDir) === path.resolve(previousDir)) return { dir: nextDir, moved: 0 }

  ensureBackupsDir(nextDir)

  let moved = 0
  if (fs.existsSync(previousDir)) {
    for (const name of fs.readdirSync(previousDir)) {
      if (!name.startsWith(BACKUP_PREFIX) || !name.endsWith('.db')) continue
      const from = path.join(previousDir, name)
      // On a name collision, suffix the destination so we never strand the old
      // file in the previous directory (and never overwrite an existing backup).
      let to = path.join(nextDir, name)
      if (fs.existsSync(to)) {
        const base = name.replace(/\.db$/, '')
        let n = 1
        while (fs.existsSync(to)) to = path.join(nextDir, `${base}-${n++}.db`)
      }
      try {
        fs.renameSync(from, to)
      } catch {
        try {
          fs.copyFileSync(from, to)
          fs.unlinkSync(from)
        } catch { continue }
      }
      moved++
    }
  }

  writeSetting('backup_dir', nextDir)
  return { dir: nextDir, moved }
}

/** Revert to the default backups folder inside userData. Files are left where they are. */
export function resetBackupsDir(): void {
  writeSetting('backup_dir', '')
}

/**
 * Run on app startup. Performs an automatic backup if one is due based on
 * the configured frequency. Safe to call when no DB file exists yet.
 */
export function runStartupBackup(): BackupFile | null {
  if (!fs.existsSync(DB_FILE)) return null
  const settings = getBackupSettings()
  if (!isBackupDue(settings)) return null
  try {
    return createBackup()
  } catch (e) {
    console.error('Startup backup failed:', e)
    return null
  }
}

export interface BackupStatus {
  enabled: boolean
  frequency: BackupFrequency
  retention: number
  backupsDir: string
  backupsDirIsDefault: boolean
  lastBackupAt: string | null
  backups: BackupFile[]
}

export function getBackupStatus(): BackupStatus {
  const settings = getBackupSettings()
  const list = listBackups()
  const dir = getBackupsDir()
  return {
    ...settings,
    backupsDir: dir,
    backupsDirIsDefault: path.resolve(dir) === path.resolve(DEFAULT_BACKUPS_DIR),
    lastBackupAt: list[0]?.createdAt ?? null,
    backups: list,
  }
}
