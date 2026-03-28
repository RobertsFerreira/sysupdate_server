import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { Database } from "bun:sqlite";

const DEFAULT_DB_PATH = resolve(process.cwd(), "data", "sysupdate.db");

let dbInstance: Database | null = null;
let dbPathInUse: string | null = null;

function applySchema(db: Database): void {
  db.run("PRAGMA foreign_keys = ON;");

  db.run(`
    CREATE TABLE IF NOT EXISTS releases (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      version         TEXT NOT NULL UNIQUE,
      description     TEXT,
      min_version     TEXT,
      bundle_file     TEXT NOT NULL,
      bundle_checksum TEXT NOT NULL,
      release_date    TEXT NOT NULL,
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS release_files (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      release_id INTEGER NOT NULL REFERENCES releases(id),
      target     TEXT NOT NULL,
      checksum   TEXT NOT NULL
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash   TEXT NOT NULL UNIQUE,
      label      TEXT,
      allowed_ip TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used  TEXT,
      revoked    INTEGER NOT NULL DEFAULT 0
    );
  `);

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_one_active_per_ip
    ON api_keys(allowed_ip)
    WHERE revoked = 0;
  `);
}

export function initializeDatabase(dbPath: string = DEFAULT_DB_PATH): Database {
  const resolvedDbPath = resolve(dbPath);

  if (dbInstance && dbPathInUse === resolvedDbPath) {
    return dbInstance;
  }

  if (dbInstance && dbPathInUse !== resolvedDbPath) {
    dbInstance.close();
    dbInstance = null;
    dbPathInUse = null;
  }

  mkdirSync(dirname(resolvedDbPath), { recursive: true });

  dbInstance = new Database(resolvedDbPath);
  dbPathInUse = resolvedDbPath;

  applySchema(dbInstance);

  return dbInstance;
}

export function getDatabase(): Database {
  if (dbInstance) {
    return dbInstance;
  }

  return initializeDatabase();
}

export function closeDatabase(): void {
  if (!dbInstance) {
    return;
  }

  dbInstance.close();
  dbInstance = null;
  dbPathInUse = null;
}
