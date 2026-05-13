import Database from "better-sqlite3";
import { join } from "path";
import { app } from "electron";

export interface PresetRow {
  id: string;
  name: string;
  data: string;
  saved_at: number;
}

export interface ScheduledTaskRow {
  id: string;
  preset_id: string;
  preset_name: string;
  driver_idx: number;
  scheduled_for: number;
  status: string;
}

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = join(app.getPath("userData"), "bot.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS presets (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      data      TEXT NOT NULL,
      saved_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id             TEXT PRIMARY KEY,
      preset_id      TEXT NOT NULL,
      preset_name    TEXT NOT NULL,
      driver_idx     INTEGER NOT NULL,
      scheduled_for  INTEGER NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}

// ---- Presets ----

export function loadPresets(): unknown[] {
  const rows = getDb().prepare("SELECT * FROM presets ORDER BY saved_at ASC").all() as PresetRow[];
  return rows.map((r) => ({ ...JSON.parse(r.data), id: r.id, name: r.name, savedAt: r.saved_at }));
}

export function savePresets(presets: unknown[]): void {
  const insert = getDb().prepare(
    "INSERT OR REPLACE INTO presets (id, name, data, saved_at) VALUES (?, ?, ?, ?)",
  );
  const deleteAll = getDb().prepare("DELETE FROM presets");

  const run = getDb().transaction((rows: unknown[]) => {
    deleteAll.run();
    for (const p of rows as Array<{ id: string; name: string; savedAt: number }>) {
      insert.run(p.id, p.name, JSON.stringify(p), p.savedAt ?? Date.now());
    }
  });

  run(presets);
}

// ---- Scheduled Tasks ----

export function loadScheduledTasks(): unknown[] {
  const rows = getDb()
    .prepare("SELECT * FROM scheduled_tasks ORDER BY scheduled_for ASC")
    .all() as ScheduledTaskRow[];
  return rows.map((r) => ({
    id: r.id,
    presetId: r.preset_id,
    presetName: r.preset_name,
    driverIdx: r.driver_idx,
    scheduledFor: r.scheduled_for,
    status: r.status,
  }));
}

export function saveScheduledTasks(tasks: unknown[]): void {
  const insert = getDb().prepare(
    `INSERT OR REPLACE INTO scheduled_tasks
       (id, preset_id, preset_name, driver_idx, scheduled_for, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const deleteAll = getDb().prepare("DELETE FROM scheduled_tasks");

  const run = getDb().transaction((rows: unknown[]) => {
    deleteAll.run();
    for (const t of rows as Array<{
      id: string;
      presetId: string;
      presetName: string;
      driverIdx: number;
      scheduledFor: number;
      status: string;
    }>) {
      insert.run(t.id, t.presetId, t.presetName, t.driverIdx, t.scheduledFor, t.status);
    }
  });

  run(tasks);
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
