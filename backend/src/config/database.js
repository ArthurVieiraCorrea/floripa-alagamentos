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
}

module.exports = { getDb };
