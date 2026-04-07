const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../data/alagamentos.db');

let db;

function getDb() {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    db = new Database(DB_PATH);
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.run(`PRAGMA journal_mode=WAL`);
  db.run(`
    CREATE TABLE IF NOT EXISTS ocorrencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      bairro TEXT NOT NULL,
      nivel TEXT NOT NULL CHECK(nivel IN ('baixo', 'medio', 'alto', 'critico')),
      descricao TEXT,
      fonte TEXT DEFAULT 'manual',
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      nome TEXT,
      refresh_token_enc TEXT,
      calendar_connected INTEGER DEFAULT 0,
      calendar_disconnected INTEGER DEFAULT 0,
      criado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forecasts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      bairro          TEXT    NOT NULL DEFAULT 'florianopolis',
      forecast_time   TEXT    NOT NULL,
      precipitacao_mm REAL    NOT NULL DEFAULT 0,
      fonte           TEXT    NOT NULL DEFAULT 'open-meteo',
      fetched_at      TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(bairro, forecast_time)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_forecasts_bairro_time
      ON forecasts(bairro, forecast_time)
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS forecasts_meta (
      id              INTEGER PRIMARY KEY DEFAULT 1,
      last_fetched_at TEXT,
      status          TEXT    NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('ok', 'error', 'pending')),
      precip_48h_mm   REAL    NOT NULL DEFAULT 0,
      last_error      TEXT
    )
  `);

  db.run(`INSERT OR IGNORE INTO forecasts_meta(id) VALUES(1)`);

  db.run(`
    CREATE TABLE IF NOT EXISTS risk_scores (
      id                           INTEGER PRIMARY KEY AUTOINCREMENT,
      bairro                       TEXT    NOT NULL,
      window_hours                 INTEGER NOT NULL CHECK(window_hours IN (24, 48, 72)),
      score                        REAL    NOT NULL,
      nivel                        TEXT    NOT NULL CHECK(nivel IN ('verde', 'amarelo', 'laranja', 'vermelho')),
      precipitacao_prevista_mm     REAL    NOT NULL DEFAULT 0,
      ocorrencias_historicas_count INTEGER NOT NULL DEFAULT 0,
      insufficient_data            INTEGER NOT NULL DEFAULT 0,
      calculated_at                TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(bairro, window_hours)
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risk_scores_bairro_window
      ON risk_scores(bairro, window_hours)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_risk_scores_window
      ON risk_scores(window_hours)
  `);
}

module.exports = { getDb };
