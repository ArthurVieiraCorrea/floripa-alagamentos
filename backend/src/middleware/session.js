'use strict';
// Custom express-session store backed by node-sqlite3-wasm.
// connect-sqlite3 is NOT used — it requires the async native sqlite3 API,
// which is incompatible with the synchronous node-sqlite3-wasm API.
const session = require('express-session');
const { getDb } = require('../config/database');

class WasmSQLiteStore extends session.Store {
  constructor(options = {}) {
    super();
    this.table = options.table || 'sessions';
    this.ttl   = options.ttl   || 86400; // seconds; default 24h

    // Hourly cleanup of expired sessions (stale rows don't break correctness, but grow the table)
    setInterval(() => {
      try {
        getDb().run(`DELETE FROM ${this.table} WHERE expires <= strftime('%s','now')`);
      } catch (e) {
        console.error('[session] cleanup error:', e.message);
      }
    }, 60 * 60 * 1000);
  }

  get(sid, cb) {
    try {
      const row = getDb().get(
        `SELECT data FROM ${this.table} WHERE sid = ? AND expires > strftime('%s','now')`,
        [sid]
      );
      return cb(null, row ? JSON.parse(row.data) : null);
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sessionData, cb) {
    try {
      const maxAge = sessionData.cookie?.maxAge;
      const ttl    = maxAge ? Math.floor(maxAge / 1000) : this.ttl;
      const expires = Math.floor(Date.now() / 1000) + ttl;
      getDb().run(
        `INSERT OR REPLACE INTO ${this.table} (sid, data, expires) VALUES (?, ?, ?)`,
        [sid, JSON.stringify(sessionData), expires]
      );
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  destroy(sid, cb) {
    try {
      getDb().run(`DELETE FROM ${this.table} WHERE sid = ?`, [sid]);
      return cb(null);
    } catch (err) {
      return cb(err);
    }
  }

  touch(sid, sessionData, cb) {
    return this.set(sid, sessionData, cb);
  }
}

module.exports = WasmSQLiteStore;
