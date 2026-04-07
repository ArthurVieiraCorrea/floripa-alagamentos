'use strict';
// riskEngine.js
// RISCO-01: Calcula score 0-100 por bairro cruzando precipitação × histórico.
// RISCO-02: Categoriza em 4 níveis de cor.
// RISCO-03: Chamado pelo scheduler a cada 4h (e na startup).
// RISCO-04: insufficient_data=true quando count < 5 ocorrências históricas.

const { getDb } = require('../config/database');

// D-02: janelas de cálculo
const WINDOW_HOURS = [24, 48, 72];

// D-03: saturação de precipitação em 80mm por janela
const PRECIP_SATURATION = 80;

// D-05: saturação histórica em 10 ocorrências
const HIST_SATURATION = 10;

// D-04: threshold de dados insuficientes
const INSUFFICIENT_THRESHOLD = 5;

// D-01: Lista canônica de ~50 bairros oficiais de Florianópolis.
// Nomes devem coincidir com properties.name do GeoJSON da Fase 4.
// Fonte: Wikipedia — Lista de distritos e bairros de Florianópolis
const BAIRROS_FLORIANOPOLIS = [
  // Ilha — Norte
  'Canasvieiras', 'Jurerê', 'Daniela', 'Ponta das Canas', 'Cachoeira do Bom Jesus',
  'Ingleses', 'Santinho', 'Rio Vermelho', 'Vargem Grande', 'Vargem Pequena',
  // Ilha — Leste
  'Barra da Lagoa', 'Lagoa da Conceição', 'Praia Mole', 'São João do Rio Vermelho',
  // Ilha — Sul
  'Campeche', 'Morro das Pedras', 'Armação', 'Pântano do Sul', 'Ribeirão da Ilha',
  'Tapera', 'Carianos', 'Costeira do Pirajubaé', 'Saco dos Limões',
  // Ilha — Central/Leste
  'Rio Tavares', 'Itacorubi', 'Trindade', 'Córrego Grande', 'Santa Mônica',
  'Pantanal', 'Serrinha',
  // Ilha — Central
  'Centro', 'Agronômica', 'José Mendes', 'Saco Grande', 'João Paulo',
  'Santo Antônio de Lisboa', 'Ratones', 'Sambaqui', 'Cacupé',
  // Continental
  'Estreito', 'Capoeiras', 'Coqueiros', 'Abraão', 'Balneário', 'Coloninha',
  'Monte Cristo', 'Jardim Atlântico', 'Itaguaçu', 'Bom Abrigo', 'Bela Vista',
];

/**
 * Categoriza score numérico em nível de risco textual.
 * D-06: Verde 0-25, Amarelo 26-50, Laranja 51-75, Vermelho 76-100.
 * @param {number} score
 * @returns {'verde'|'amarelo'|'laranja'|'vermelho'}
 */
function categorizarNivel(score) {
  if (score <= 25) return 'verde';
  if (score <= 50) return 'amarelo';
  if (score <= 75) return 'laranja';
  return 'vermelho';
}

/**
 * Normaliza nome de bairro para comparação tolerante a acentos e capitalização.
 * Ex: "Agronômica" → "agronomica"
 * @param {string} nome
 * @returns {string}
 */
function normalizarNome(nome) {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Calcula e persiste scores de risco para todos os bairros e janelas.
 * Nunca faz throw — loga erros e retorna silenciosamente.
 * Segue o padrão de forecastService.js.
 *
 * @returns {Promise<void>}
 */
async function calcularRiscos() {
  const db = getDb();

  // Passo 1: Somar precipitação por janela (3 queries — não 150).
  // Pitfall UTC: forecast_time armazenado em hora local (UTC-3).
  // datetime('now') retorna UTC. Subtrai 3h antes de comparar.
  const precipPorJanela = {};
  try {
    for (const horas of WINDOW_HOURS) {
      const row = db.get(
        `SELECT COALESCE(SUM(precipitacao_mm), 0) AS total_mm
           FROM forecasts
          WHERE bairro = 'florianopolis'
            AND forecast_time >= datetime('now', '-3 hours')
            AND forecast_time <  datetime('now', '-3 hours', '+${horas} hours')`
      );
      precipPorJanela[horas] = row.total_mm;
    }
  } catch (err) {
    console.error('[riskEngine] Erro ao consultar forecasts:', err.message);
    return;
  }

  // Log de aviso se todos os valores forem zero (forecasts ainda pendentes)
  const allZero = WINDOW_HOURS.every(h => precipPorJanela[h] === 0);
  if (allZero) {
    console.warn('[riskEngine] forecasts cache pendente — scores calculados com precipitacao=0');
  }

  // Passo 2: Contar ocorrências históricas por bairro (1 query).
  // LOWER(TRIM()) tolera variações de digitação em ocorrencias.bairro.
  let historicoRows;
  try {
    historicoRows = db.all(
      `SELECT LOWER(TRIM(bairro)) AS bairro_norm, COUNT(*) AS total
         FROM ocorrencias
        GROUP BY LOWER(TRIM(bairro))`
    );
  } catch (err) {
    console.error('[riskEngine] Erro ao consultar ocorrencias:', err.message);
    return;
  }

  // Mapa: nome_normalizado → contagem
  const historicoMap = new Map();
  for (const r of historicoRows) {
    historicoMap.set(r.bairro_norm, r.total);
  }

  // Passo 3: Calcular 150 scores em JavaScript
  const riskRows = [];
  for (const bairro of BAIRROS_FLORIANOPOLIS) {
    const bairroNorm = normalizarNome(bairro);
    const count = historicoMap.get(bairroNorm) ?? 0;
    const insufficientData = count < INSUFFICIENT_THRESHOLD; // RISCO-04

    for (const horas of WINDOW_HOURS) {
      const precip = precipPorJanela[horas];

      // D-03: normalização linear com saturação em 80mm
      const scoreP = Math.min(precip / PRECIP_SATURATION, 1.0) * 100;

      // D-05: score histórico com saturação em 10 ocorrências
      const scoreH = Math.min(count / HIST_SATURATION, 1.0) * 100;

      // D-04: pesos ajustados quando dados insuficientes
      const wP = insufficientData ? 0.9 : 0.6;
      const wH = insufficientData ? 0.1 : 0.4;
      const score = Math.round((wP * scoreP + wH * scoreH) * 10) / 10;

      riskRows.push({
        bairro,
        window_hours: horas,
        score,
        nivel: categorizarNivel(score),          // D-06
        precip_mm: Math.round(precip * 10) / 10,
        count,
        insufficient_data: insufficientData ? 1 : 0,
      });
    }
  }

  // Passo 4: Persistir 150 linhas em uma única transação
  db.run('BEGIN');
  try {
    for (const r of riskRows) {
      db.run(
        `INSERT OR REPLACE INTO risk_scores
           (bairro, window_hours, score, nivel, precipitacao_prevista_mm,
            ocorrencias_historicas_count, insufficient_data, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [r.bairro, r.window_hours, r.score, r.nivel,
         r.precip_mm, r.count, r.insufficient_data]
      );
    }
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) {}
    console.error('[riskEngine] Erro ao persistir risk scores:', err.message);
    return;
  }

  console.log(`[riskEngine] ${riskRows.length} scores calculados e persistidos.`);
}

module.exports = { calcularRiscos };
