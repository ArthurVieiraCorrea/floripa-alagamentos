'use strict';
const { getDb } = require('../config/database');
const { calcularRiscos } = require('../services/riskEngine');
const { checkAndSendAlerts } = require('../services/alertService');

// ── Constantes ───────────────────────────────────────────
const NIVEIS_VALIDOS = ['baixo', 'medio', 'alto', 'critico'];

// Normalização de nível: aceita variantes com acentos e maiúsculas
const NIVEL_MAP = {
  baixo:   'baixo',
  medio:   'medio',
  médio:   'medio',
  alto:    'alto',
  critico: 'critico',
  crítico: 'critico',
};

// ── Helpers ──────────────────────────────────────────────

/**
 * Normaliza string de data para "YYYY-MM-DD HH:MM:SS".
 * Aceita: ISO 8601, DD/MM/YYYY, DD/MM/YYYY HH:MM:SS.
 * Retorna null se não reconhecido.
 * @param {string} raw
 * @returns {string|null}
 */
function normalizarData(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // ISO 8601: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS (com ou sem fuso)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').slice(0, 19);
    }
  }

  // DD/MM/YYYY ou DD/MM/YYYY HH:MM ou DD/MM/YYYY HH:MM:SS
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);
  if (m) {
    const [, dd, mm, yyyy, time] = m;
    const iso = `${yyyy}-${mm}-${dd}T${time || '00:00:00'}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return `${yyyy}-${mm}-${dd} ${time ? time.length === 5 ? time + ':00' : time : '00:00:00'}`;
    }
  }

  return null;
}

/**
 * Faz split de uma linha CSV respeitando campos entre aspas.
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Faz parsing do texto CSV para array de objetos keyed por header.
 * @param {string} text
 * @returns {{ headers: string[], rows: Array<{linha: number, raw: Object}>, erro?: string }}
 */
function parseCsv(text) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter(l => l.trim() !== '');

  if (lines.length < 2) {
    return { headers: [], rows: [], erro: 'CSV deve ter cabeçalho e ao menos uma linha de dados.' };
  }

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/^["']|["']$/g, ''));

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const raw = {};
    headers.forEach((h, idx) => { raw[h] = (vals[idx] ?? '').replace(/^["']|["']$/g, ''); });
    rows.push({ linha: i + 1, raw });
  }

  return { headers, rows };
}

/**
 * Valida e normaliza uma linha do CSV.
 * Suporta aliases de colunas: lat/latitude, lon/lng/longitude, data/date/data_ocorrencia.
 * @param {{ linha: number, raw: Object }} entry
 * @returns {{ linha: number, valida: boolean, dados?: Object, erros?: string[] }}
 */
function validarLinha({ linha, raw }) {
  const erros = [];

  const lat    = parseFloat(raw.latitude ?? raw.lat ?? '');
  const lng    = parseFloat(raw.longitude ?? raw.lng ?? raw.lon ?? '');
  const bairro = String(raw.bairro ?? '').trim();
  const nivelRaw = String(raw.nivel ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const nivel  = NIVEL_MAP[nivelRaw] ?? nivelRaw;
  const data   = normalizarData(raw.data ?? raw.date ?? raw.data_ocorrencia ?? '');
  const descricao = String(raw.descricao ?? raw.description ?? '').trim() || null;

  if (isNaN(lat) || lat < -90 || lat > 90)
    erros.push('latitude inválida (esperado número entre -90 e 90)');
  if (isNaN(lng) || lng < -180 || lng > 180)
    erros.push('longitude inválida (esperado número entre -180 e 180)');
  if (!bairro || bairro.length < 2)
    erros.push('bairro obrigatório (mínimo 2 caracteres)');
  if (!NIVEIS_VALIDOS.includes(nivel))
    erros.push(`nivel inválido: "${raw.nivel}" — use: baixo, medio, alto, critico`);
  if (!data)
    erros.push('data inválida ou ausente (use YYYY-MM-DD ou DD/MM/YYYY)');

  if (erros.length > 0) return { linha, valida: false, erros };

  return { linha, valida: true, dados: { latitude: lat, longitude: lng, bairro, nivel, data, descricao } };
}

/**
 * Verifica quais linhas válidas já existem no banco (chave: bairro + nivel + data).
 * @param {Array<{ linha: number, dados: Object }>} linhasValidas
 * @returns {Array<{ linha: number, dados: Object, duplicata: boolean, id_existente?: number }>}
 */
function checarDuplicatas(linhasValidas) {
  const db = getDb();
  return linhasValidas.map(lv => {
    const { bairro, nivel, data } = lv.dados;
    const datePart = data.slice(0, 10); // YYYY-MM-DD
    const existe = db.get(
      `SELECT id FROM ocorrencias
       WHERE lower(bairro) = lower(?) AND nivel = ? AND date(criado_em) = date(?)`,
      [bairro, nivel, datePart]
    );
    return existe
      ? { ...lv, duplicata: true,  id_existente: existe.id }
      : { ...lv, duplicata: false };
  });
}

// ── Controller ───────────────────────────────────────────

const AdminController = {
  /**
   * POST /api/admin/preview
   * Recebe texto CSV no body (Content-Type: text/plain ou text/csv).
   * Retorna prévia: linhas válidas (novas), duplicatas, erros — sem inserir nada.
   */
  preview(req, res) {
    const text = typeof req.body === 'string' ? req.body : '';
    if (!text.trim()) {
      return res.status(400).json({ erro: 'Body CSV ausente ou vazio.' });
    }

    const { rows, erro } = parseCsv(text);
    if (erro) return res.status(400).json({ erro });

    const validated    = rows.map(validarLinha);
    const validas      = validated.filter(r => r.valida);
    const invalidas    = validated.filter(r => !r.valida);

    const comDuplicatas = checarDuplicatas(validas);
    const novas        = comDuplicatas.filter(r => !r.duplicata);
    const duplicatas   = comDuplicatas.filter(r =>  r.duplicata);

    res.json({
      total_linhas:       rows.length,
      validas:            novas.length,
      duplicatas:         duplicatas.length,
      erros:              invalidas.length,
      preview:            novas.map(r => ({ linha: r.linha, ...r.dados })),
      duplicatas_detalhe: duplicatas.map(r => ({ linha: r.linha, ...r.dados, id_existente: r.id_existente })),
      erros_detalhe:      invalidas.map(r => ({ linha: r.linha, erros: r.erros })),
    });
  },

  /**
   * POST /api/admin/confirmar
   * Recebe JSON { linhas: [...] } com as linhas previamente validadas.
   * Re-verifica duplicatas e insere; retorna { inseridos, duplicatas_ignoradas, erros }.
   */
  async confirmar(req, res) {
    const { linhas } = req.body || {};
    if (!Array.isArray(linhas) || linhas.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma linha para importar.' });
    }

    const db = getDb();
    let inseridos          = 0;
    let duplicatas_ignoradas = 0;
    const erros            = [];

    for (const dados of linhas) {
      try {
        const { latitude, longitude, bairro, nivel, data, descricao } = dados;

        // Validação mínima de segurança (re-entrypoint)
        if (latitude == null || longitude == null || !bairro || !nivel || !data) {
          erros.push({ dados, erro: 'Campos obrigatórios ausentes.' });
          continue;
        }
        if (!NIVEIS_VALIDOS.includes(nivel)) {
          erros.push({ dados, erro: `Nivel inválido: "${nivel}"` });
          continue;
        }

        // Re-checar duplicata antes de inserir
        const datePart = data.slice(0, 10);
        const existe = db.get(
          `SELECT id FROM ocorrencias
           WHERE lower(bairro) = lower(?) AND nivel = ? AND date(criado_em) = date(?)`,
          [bairro, nivel, datePart]
        );
        if (existe) {
          duplicatas_ignoradas++;
          continue;
        }

        db.run(
          `INSERT INTO ocorrencias (latitude, longitude, bairro, nivel, descricao, fonte, criado_em, atualizado_em)
           VALUES (?, ?, ?, ?, ?, 'csv', ?, ?)`,
          [latitude, longitude, bairro, nivel, descricao ?? null, data, data]
        );
        inseridos++;
      } catch (err) {
        erros.push({ dados, erro: err.message });
      }
    }

    // Auto-trigger best-effort: recalcular riscos e verificar alertas após importação (D-04, D-07)
    let recalculo = 'ok';
    try {
      await calcularRiscos();
      await checkAndSendAlerts();
    } catch (err) {
      console.error('[admin] Erro no recálculo automático pós-confirmar:', err.message);
      recalculo = 'erro';
    }

    res.json({ inseridos, duplicatas_ignoradas, erros, recalculo });
  },

  /**
   * POST /api/admin/recalcular
   * Dispara calcularRiscos() imediatamente, sem esperar pelo próximo ciclo do cron.
   * Útil após importação de dados históricos (HIST-03: lag de até 4h eliminado).
   */
  async recalcular(req, res) {
    try {
      await calcularRiscos();
      await checkAndSendAlerts();
      res.json({ ok: true, mensagem: 'Risco recalculado com sucesso.' });
    } catch (err) {
      console.error('[admin] Erro ao recalcular riscos:', err.message);
      res.status(500).json({ erro: 'Erro ao recalcular riscos.' });
    }
  },
};

module.exports = AdminController;
