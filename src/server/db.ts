import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../../data')

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.mkdirSync(path.join(DATA_DIR, 'logs'), { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'scheduler.db')

const db = new DatabaseSync(DB_PATH, { enableForeignKeyConstraints: true })

db.exec("PRAGMA journal_mode = WAL")

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    repo_path   TEXT NOT NULL,
    prompt      TEXT NOT NULL DEFAULT '',
    session_id  TEXT,
    cron_expr   TEXT,
    next_run_at TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS runs (
    id           TEXT PRIMARY KEY,
    task_id      TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    started_at   TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at     TEXT,
    status       TEXT NOT NULL DEFAULT 'running',
    exit_code    INTEGER,
    pid          INTEGER,
    window_title TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_runs_task_id ON runs(task_id);
  CREATE INDEX IF NOT EXISTS idx_runs_status  ON runs(status);
`)

export { db }
export default db
