import initSqlJs from 'sql.js'
import type { Database as SqlJsDb } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import { getPresetsForDrivetrain } from './presets/serviceIntervals'

const DB_PATH = path.join(app.getPath('userData'), 'dmax-tracker.db')

// Resolve sql.js's actual install location (could be in a parent node_modules
// when running from a git worktree without its own deps installed).
const requireFromHere = createRequire(import.meta.url)
function locateSqlJsFile(file: string): string {
  // Prefer the app's bundled location for production builds.
  const bundled = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file)
  if (fs.existsSync(bundled)) return bundled
  // Fall back to wherever Node actually resolves sql.js — handles worktrees,
  // hoisted monorepos, and any other non-flat install layout. sql.js uses
  // package `exports` that block resolving `./package.json` directly, so we
  // resolve the main entry (which lives in `dist/`) and use its directory.
  try {
    const mainEntry = requireFromHere.resolve('sql.js')
    return path.join(path.dirname(mainEntry), file)
  } catch {
    return bundled
  }
}

let sqlDb: SqlJsDb | null = null
let inTx = false

function persist(): void {
  if (!sqlDb || inTx) return
  const data = sqlDb.export()
  fs.writeFileSync(DB_PATH, Buffer.from(data))
}

// Convert better-sqlite3 style params to sql.js BindParams.
// better-sqlite3 accepts bare object keys like { date: '...' } when SQL uses @date.
// sql.js requires { '@date': '...' } (keys must match the placeholder prefix).
function toBindParams(args: unknown[]): import('sql.js').BindParams {
  if (args.length === 0) return null
  if (args.length === 1) {
    const a = args[0]
    if (a !== null && typeof a === 'object' && !Array.isArray(a)) {
      const obj = a as Record<string, unknown>
      const keys = Object.keys(obj)
      if (keys.length > 0 && !keys[0].startsWith('@') && !keys[0].startsWith(':') && !keys[0].startsWith('$')) {
        const prefixed: Record<string, unknown> = {}
        for (const k of keys) prefixed[`@${k}`] = obj[k]
        return prefixed as import('sql.js').ParamsObject
      }
      return obj as import('sql.js').ParamsObject
    }
  }
  const flat = (args as unknown[]).flat()
  return flat.length ? (flat as import('sql.js').SqlValue[]) : null
}

class Stmt {
  constructor(private db: SqlJsDb, private sql: string) {}

  get(...args: unknown[]): Record<string, unknown> | undefined {
    const params = toBindParams(args)
    const stmt = this.db.prepare(this.sql)
    if (params) stmt.bind(params)
    const row = stmt.step() ? (stmt.getAsObject() as Record<string, unknown>) : undefined
    stmt.free()
    return row
  }

  all(...args: unknown[]): Record<string, unknown>[] {
    const params = toBindParams(args)
    const stmt = this.db.prepare(this.sql)
    if (params) stmt.bind(params)
    const rows: Record<string, unknown>[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, unknown>)
    stmt.free()
    return rows
  }

  run(...args: unknown[]): { lastInsertRowid: number; changes: number } {
    const params = toBindParams(args)
    const stmt = this.db.prepare(this.sql)
    if (params !== null) stmt.run(params)
    else stmt.run()
    stmt.free()
    let lastInsertRowid = 0
    const rid = this.db.prepare('SELECT last_insert_rowid() as id')
    if (rid.step()) lastInsertRowid = Number(rid.getAsObject().id ?? 0)
    rid.free()
    persist()
    return { lastInsertRowid, changes: 1 }
  }
}

class Db {
  constructor(private db: SqlJsDb) {}

  prepare(sql: string): Stmt {
    return new Stmt(this.db, sql)
  }

  exec(sql: string): void {
    this.db.exec(sql)
  }

  pragma(_str: string): void {
    // Handled during init
  }

  transaction<T extends (...args: unknown[]) => unknown>(fn: T): T {
    return ((...args: unknown[]) => {
      this.db.run('BEGIN TRANSACTION')
      inTx = true
      try {
        const result = fn(...args)
        this.db.run('COMMIT')
        inTx = false
        persist()
        return result
      } catch (e) {
        this.db.run('ROLLBACK')
        inTx = false
        throw e
      }
    }) as T
  }
}

let dbInstance: Db | null = null

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs({ locateFile: locateSqlJsFile })

  const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null
  sqlDb = buffer ? new SQL.Database(buffer) : new SQL.Database()
  sqlDb.run('PRAGMA foreign_keys = ON')

  dbInstance = new Db(sqlDb)
  initSchema(dbInstance)
  migrate(dbInstance)
  seedDefaultData(dbInstance)
  persist()
}

export function getDb(): Db {
  if (!dbInstance) throw new Error('DB not initialized — call initDb() first')
  return dbInstance
}

// Helper used by handlers — returns the user's currently-selected vehicle id.
// Falls back to 1 (the seeded default) if the setting is missing.
export function getCurrentVehicleId(): number {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'current_vehicle_id'").get() as { value: string } | undefined
  return row ? parseInt(row.value, 10) || 1 : 1
}

function initSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      trim TEXT,
      drivetrain TEXT NOT NULL DEFAULT 'petrol-na',
      vin TEXT,
      license_plate TEXT,
      color TEXT,
      photo TEXT,
      purchase_date TEXT,
      purchase_odometer REAL,
      current_odometer REAL NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fuel_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL DEFAULT 1 REFERENCES vehicles(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      litres REAL NOT NULL,
      cost_per_litre REAL NOT NULL,
      total_cost REAL NOT NULL,
      fuel_station TEXT,
      full_tank INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      receipt_photo TEXT,
      consumption REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL DEFAULT 1 REFERENCES vehicles(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      cost REAL NOT NULL,
      shop_name TEXT,
      parts_replaced TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS maintenance_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL REFERENCES maintenance_log(id) ON DELETE CASCADE,
      photo_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS service_intervals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL DEFAULT 1 REFERENCES vehicles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      category_key TEXT,
      interval_km REAL NOT NULL,
      last_done_km REAL,
      last_done_date TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      consequence_of_skipping TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS insurance_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL DEFAULT 1 REFERENCES vehicles(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      policy_number TEXT NOT NULL,
      coverage_type TEXT NOT NULL,
      premium_amount REAL NOT NULL,
      payment_frequency TEXT NOT NULL,
      start_date TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      agent_name TEXT,
      agent_contact TEXT,
      notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS insurance_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      policy_id INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
      photo_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS note_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      reference_number TEXT,
      issuer TEXT,
      issued_date TEXT,
      expiry_date TEXT,
      cost REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vehicle_document_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES vehicle_documents(id) ON DELETE CASCADE,
      photo_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tire_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      size TEXT NOT NULL,
      dot_date TEXT,
      install_date TEXT NOT NULL,
      install_odometer REAL NOT NULL,
      retired_date TEXT,
      retired_odometer REAL,
      recommended_psi_front REAL,
      recommended_psi_rear REAL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tire_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tire_set_id INTEGER NOT NULL REFERENCES tire_sets(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      tread_fl REAL,
      tread_fr REAL,
      tread_rl REAL,
      tread_rr REAL,
      pressure_fl REAL,
      pressure_fr REAL,
      pressure_rl REAL,
      pressure_rr REAL,
      notes TEXT,
      photo TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tire_rotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tire_set_id INTEGER NOT NULL REFERENCES tire_sets(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      odometer REAL NOT NULL,
      pattern TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

interface ColumnInfo { name: string; notnull: number }

function tableHasColumn(db: Db, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[]
  return cols.some(c => c.name === column)
}

function columnIsNotNull(db: Db, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as ColumnInfo[]
  const col = cols.find(c => c.name === column)
  return !!col && col.notnull === 1
}

function tableExists(db: Db, table: string): boolean {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  ).get(table)
  return !!row
}

/**
 * Migrate existing databases (pre-multi-vehicle) to the new schema.
 *
 * Strategy: detect missing columns via PRAGMA table_info and ALTER TABLE ADD COLUMN
 * with sensible defaults (vehicle_id = 1, the seeded default vehicle).
 *
 * Safe to run repeatedly — every step checks before applying.
 */
function migrate(db: Db): void {
  const tablesNeedingVehicleId = [
    'fuel_log', 'maintenance_log', 'service_intervals', 'insurance_policies'
  ]
  for (const table of tablesNeedingVehicleId) {
    if (tableExists(db, table) && !tableHasColumn(db, table, 'vehicle_id')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN vehicle_id INTEGER NOT NULL DEFAULT 1`)
    }
  }

  // notes.vehicle_id is nullable (notes can be global)
  if (tableExists(db, 'notes') && !tableHasColumn(db, 'notes', 'vehicle_id')) {
    db.exec(`ALTER TABLE notes ADD COLUMN vehicle_id INTEGER`)
  }

  // Relax NOT NULL constraint on vehicle_documents.expiry_date so users can
  // log items that don't expire (warranties, roadside-assistance contracts,
  // anything where the renewal model is irrelevant). SQLite can't ALTER COLUMN
  // to change a constraint, so rebuild the table if it has the old constraint.
  if (tableExists(db, 'vehicle_documents') && columnIsNotNull(db, 'vehicle_documents', 'expiry_date')) {
    db.exec(`
      CREATE TABLE vehicle_documents_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        doc_type TEXT NOT NULL,
        title TEXT NOT NULL,
        reference_number TEXT,
        issuer TEXT,
        issued_date TEXT,
        expiry_date TEXT,
        cost REAL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO vehicle_documents_new (id, vehicle_id, doc_type, title, reference_number, issuer, issued_date, expiry_date, cost, notes, created_at)
      SELECT id, vehicle_id, doc_type, title, reference_number, issuer, issued_date, expiry_date, cost, notes, created_at FROM vehicle_documents;
      DROP TABLE vehicle_documents;
      ALTER TABLE vehicle_documents_new RENAME TO vehicle_documents;
    `)
  }

  // service_intervals new columns
  if (tableExists(db, 'service_intervals')) {
    if (!tableHasColumn(db, 'service_intervals', 'category_key')) {
      db.exec(`ALTER TABLE service_intervals ADD COLUMN category_key TEXT`)
    }
    if (!tableHasColumn(db, 'service_intervals', 'consequence_of_skipping')) {
      db.exec(`ALTER TABLE service_intervals ADD COLUMN consequence_of_skipping TEXT`)
    }
  }
}

function seedDefaultData(db: Db): void {
  // ─── Global settings ───────────────────────────────────────────────────────
  const settingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  settingStmt.run('current_odometer', '0')
  settingStmt.run('current_vehicle_id', '1')
  settingStmt.run('distance_unit', 'km')
  settingStmt.run('currency', 'BBD')
  settingStmt.run('theme', 'dark')
  settingStmt.run('notifications_enabled', 'true')
  settingStmt.run('has_seen_welcome', 'false')
  settingStmt.run('backup_enabled', 'true')
  settingStmt.run('backup_frequency', 'daily')
  settingStmt.run('backup_retention', '10')

  // ─── Seed default vehicle (the original D-Max) ────────────────────────────
  const { count: vehicleCount } = db.prepare(
    'SELECT COUNT(*) as count FROM vehicles'
  ).get() as { count: number }

  if (vehicleCount === 0) {
    const odometer = parseFloat(
      (db.prepare("SELECT value FROM settings WHERE key = 'current_odometer'").get() as { value: string } | undefined)?.value ?? '0'
    )
    db.prepare(`
      INSERT INTO vehicles (id, nickname, make, model, year, drivetrain, current_odometer)
      VALUES (1, 'D-Max', 'Isuzu', 'D-Max', 2022, 'diesel', ?)
    `).run(odometer)
  }

  // ─── Heal stale diesel seed (pre-existing rows from old schema) ───────────
  const staleEntries = ['Spark Plugs', 'Timing Belt']
  const hasStale = staleEntries.some(name => {
    const row = db.prepare(
      'SELECT 1 as ok FROM service_intervals WHERE name = ? AND is_custom = 0 AND vehicle_id = 1'
    ).get(name) as { ok: number } | undefined
    return row?.ok === 1
  })
  if (hasStale) {
    db.exec('DELETE FROM service_intervals WHERE is_custom = 0 AND vehicle_id = 1')
  }

  // ─── Seed service intervals for vehicle 1 if empty ────────────────────────
  const { count: intervalCount } = db.prepare(
    'SELECT COUNT(*) as count FROM service_intervals WHERE vehicle_id = 1 AND is_custom = 0'
  ).get() as { count: number }

  if (intervalCount === 0) {
    seedIntervalsForVehicle(db, 1, 'diesel')
  } else {
    // Backfill consequence_of_skipping + category_key on existing seeded rows
    // by matching name → preset.
    backfillIntervalMetadata(db, 1, 'diesel')
  }
}

export function seedIntervalsForVehicle(db: Db, vehicleId: number, drivetrain: string): void {
  const presets = getPresetsForDrivetrain(drivetrain)
  const insert = db.prepare(`
    INSERT INTO service_intervals (vehicle_id, name, category_key, interval_km, is_custom, consequence_of_skipping)
    VALUES (@vehicle_id, @name, @category_key, @interval_km, 0, @consequence_of_skipping)
  `)
  const seed = db.transaction(() => {
    for (const p of presets) {
      insert.run({
        vehicle_id: vehicleId,
        name: p.name,
        category_key: p.category_key,
        interval_km: p.interval_km,
        consequence_of_skipping: p.consequence_of_skipping,
      })
    }
  })
  seed()
}

function backfillIntervalMetadata(db: Db, vehicleId: number, drivetrain: string): void {
  const presets = getPresetsForDrivetrain(drivetrain)
  const update = db.prepare(`
    UPDATE service_intervals
       SET category_key = @category_key,
           consequence_of_skipping = COALESCE(consequence_of_skipping, @consequence_of_skipping)
     WHERE vehicle_id = @vehicle_id
       AND is_custom = 0
       AND name = @name
  `)
  const run = db.transaction(() => {
    for (const p of presets) {
      update.run({
        vehicle_id: vehicleId,
        name: p.name,
        category_key: p.category_key,
        consequence_of_skipping: p.consequence_of_skipping,
      })
    }
  })
  run()
}
