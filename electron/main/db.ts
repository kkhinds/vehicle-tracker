import initSqlJs from 'sql.js'
import type { Database as SqlJsDb } from 'sql.js'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.join(app.getPath('userData'), 'dmax-tracker.db')

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
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', file)
  })

  const buffer = fs.existsSync(DB_PATH) ? fs.readFileSync(DB_PATH) : null
  sqlDb = buffer ? new SQL.Database(buffer) : new SQL.Database()
  sqlDb.run('PRAGMA foreign_keys = ON')

  dbInstance = new Db(sqlDb)
  initSchema(dbInstance)
  seedDefaultData(dbInstance)
  persist()
}

export function getDb(): Db {
  if (!dbInstance) throw new Error('DB not initialized — call initDb() first')
  return dbInstance
}

function initSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fuel_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      name TEXT NOT NULL,
      interval_km REAL NOT NULL,
      last_done_km REAL,
      last_done_date TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS insurance_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  `)
}

function seedDefaultData(db: Db): void {
  const settingStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  settingStmt.run('current_odometer', '0')
  settingStmt.run('distance_unit', 'km')
  settingStmt.run('currency', 'BBD')
  settingStmt.run('theme', 'dark')

  // Detect stale seed (old schema had wrong diesel entries like Spark Plugs/Timing Belt)
  const staleEntries = ['Spark Plugs', 'Timing Belt']
  const hasStale = staleEntries.some(
    name => (db.prepare('SELECT 1 as ok FROM service_intervals WHERE name = ? AND is_custom = 0').get(name) as { ok: number } | undefined)?.ok === 1
  )
  if (hasStale) {
    db.exec('DELETE FROM service_intervals WHERE is_custom = 0')
  }

  const { count } = db.prepare(
    'SELECT COUNT(*) as count FROM service_intervals WHERE is_custom = 0'
  ).get() as { count: number }

  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO service_intervals (name, interval_km, is_custom) VALUES (?, ?, 0)'
    )
    // Service intervals sourced from Isuzu 4JJ3-TCX 3.0TD official schedule
    const seed = db.transaction(() => {
      insert.run('Oil and Filter Change', 10000)           // Every 10,000 km / 6 months
      insert.run('Fuel Filter Water Separator Drain', 10000) // Drain every 10,000 km (diesel)
      insert.run('Air Filter Inspection / Replace', 30000)  // 30,000 km (halve in dusty conditions)
      insert.run('Valve Clearance (Tappet) Check', 40000)   // 4JJ3 spec
      insert.run('Fuel Filter Replacement', 40000)
      insert.run('Brake Fluid', 40000)                     // Or every 2 years
      insert.run('Transfer Case Oil', 40000)               // 4WD V-Cross
      insert.run('Differential Oil (Front & Rear)', 40000) // 4WD V-Cross
      insert.run('Glow Plugs', 60000)                      // Diesel equivalent of spark plugs
      insert.run('Automatic Transmission Fluid', 60000)    // Or every 2 years
      insert.run('Drive Belt (Auxiliary / Serpentine)', 80000)
      insert.run('Coolant Flush', 80000)                   // Or every 2 years
      insert.run('DPF (Diesel Particulate Filter) Inspect', 80000) // 2022 model has DPF
      insert.run('Timing Chain & Tensioner Inspection', 150000)    // Chain, not belt — no replacement needed
    })
    seed()
  }
}
