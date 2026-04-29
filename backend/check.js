const { Database } = require('node-sqlite3-wasm');
const db = new Database('data/alagamentos.db');
const rows = db.all("SELECT bairro, fonte, criado_em FROM ocorrencias WHERE fonte='csv' ORDER BY id DESC LIMIT 2");
console.log(rows);
