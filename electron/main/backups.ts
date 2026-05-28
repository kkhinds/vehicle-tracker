import { app, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDb } from './db'

// ─── Paths ────────────────────────────────────────────────────────────────
const USER_DATA = app.getPath('userData')
const DB_FILE = path.join(USER_DATA, 'dmax-tracker.db')
const BACKUPS_DIR = path.join(USER_DATA, 'backups')
const BACKUP_PREFIX = 'vehicle-tracker'

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
function ensureBackupsDir(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true })
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
  ensureBackupsDir()
  return fs.readdirSync(BACKUPS_DIR)
    .filter(name => name.startsWith(BACKUP_PREFIX) && name.endsWith('.db'))
    .map(name => {
      const fullPath = path.join(BACKUPS_DIR, name)
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
  const backups = listBackups()
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
  ensureBackupsDir()
  // Persist any pending writes before copying. The db module persists on
  // every run() call so the file on disk is already up to date — but if
  // we're in the middle of a transaction we don't want to copy a partial.
  // sql.js writes synchronously after each commit; this is a no-op safeguard.

  if (!fs.existsSync(DB_FILE)) {
    throw new Error('No database file exists yet to back up.')
  }

  const filename = makeBackupFilename()
  const dest = path.join(BACKUPS_DIR, filename)
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
    ensureBackupsDir()
    const safety = path.join(BACKUPS_DIR, `${BACKUP_PREFIX}-pre-restore-${Date.now()}.db`)
    fs.copyFileSync(DB_FILE, safety)
  }

  fs.copyFileSync(sourcePath, DB_FILE)
}

export function deleteBackup(filePath: string): void {
  // Guard: only allow deletions inside our backups directory.
  const resolved = path.resolve(filePath)
  const root = path.resolve(BACKUPS_DIR)
  if (!resolved.startsWith(root + path.sep)) {
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
    defaultPath: BACKUPS_DIR,
    properties: ['openFile'],
    filters: [{ name: 'Database file', extensions: ['db'] }],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export function openBackupsFolder(): void {
  ensureBackupsDir()
  void shell.openPath(BACKUPS_DIR)
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
  lastBackupAt: string | null
  backups: BackupFile[]
}

export function getBackupStatus(): BackupStatus {
  const settings = getBackupSettings()
  const list = listBackups()
  return {
    ...settings,
    backupsDir: BACKUPS_DIR,
    lastBackupAt: list[0]?.createdAt ?? null,
    backups: list,
  }
}
