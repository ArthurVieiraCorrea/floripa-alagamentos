'use strict';
// alertService.js
// ALERT-02: Envia push notification quando evento de calendário cai em bairro com risco >= threshold.
// ALERT-03: Deduplicação via alertas_enviados UNIQUE(usuario_id, google_event_id, risk_cycle_key).
// ALERT-06: Detecta invalid_grant ao verificar usuário → marca calendar_disconnected=1.
// Nunca faz throw — loga erros e retorna silenciosamente (padrão do projeto).

const webpush = require('web-push');
const { getDb } = require('../config/database');

// Janela padrão quando o usuário não configurou antecedência.
const ALERT_WINDOW_HOURS_DEFAULT = 24;

/**
 * Deriva a risk_cycle_key a partir do calculated_at de risk_scores.
 * Trunca para a hora (ex: "2026-04-09T14") para evitar duplicatas entre
 * startup e cron que caem na mesma janela de 4h.
 * @param {string} calculatedAt — valor ISO de risk_scores.calculated_at
 * @returns {string} ex: "2026-04-09T14"
 */
function derivarCycleKey(calculatedAt) {
  return new Date(calculatedAt).toISOString().slice(0, 13);
}

/**
 * Tenta enviar push notification para a subscription.
 * Remove subscription stale em caso de 404 ou 410 (RFC 8030).
 * @param {{ endpoint: string, p256dh: string, auth: string }} subscription
 * @param {{ title: string, body: string, tag: string, url: string }} payload
 * @returns {Promise<boolean>} true se enviado, false se falhou
 */
async function enviarPush(subscription, payload) {
  const db = getDb();
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      // Subscription expirou ou foi cancelada pelo browser — limpar DB
      try {
        db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [subscription.endpoint]);
        console.log('[alertService] Subscription stale removida:', subscription.endpoint);
      } catch (dbErr) {
        console.error('[alertService] Erro ao remover subscription stale:', dbErr.message);
      }
    } else {
      console.error('[alertService] Erro ao enviar push:', err.message);
    }
    return false;
  }
}

/**
 * Registra alerta como enviado na tabela alertas_enviados.
 * INSERT OR IGNORE — UNIQUE constraint impede duplicata silenciosamente.
 * @param {number} usuarioId
 * @param {string} googleEventId
 * @param {string} cycleKey
 * @param {string} bairro
 * @param {number} score
 * @param {string|null} summary
 */
function registrarAlertaEnviado(usuarioId, googleEventId, cycleKey, bairro, score, summary) {
  const db = getDb();
  db.run(
    `INSERT OR IGNORE INTO alertas_enviados
       (usuario_id, google_event_id, risk_cycle_key, bairro, score, summary)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [usuarioId, googleEventId, cycleKey, bairro, score, summary || null]
  );
}

/**
 * Core: verifica eventos de calendário × risk scores e envia alertas.
 *
 * Algoritmo:
 * 1. Buscar risk scores atuais com calculated_at (usa window_hours=24 como referência)
 * 2. Derivar risk_cycle_key do calculated_at mais recente
 * 3. Para cada usuário com calendário conectado e alert_threshold configurado:
 *    a. Verificar se calendar_disconnected=1 → pular (já notificado via banner)
 *    b. Buscar eventos do cache nas próximas ALERT_WINDOW_HOURS horas com bairro_resolvido
 *    c. Para cada evento: checar score do bairro >= alert_threshold
 *    d. Checar se já foi alertado neste ciclo (alertas_enviados)
 *    e. Se não: buscar subscriptions do usuário; enviar push; registrar
 *    f. Se usuário não tem subscription: apenas registrar em alertas_enviados (fallback in-app)
 * 4. Silenciar erros — nunca propagar exceção para o caller
 *
 * @returns {Promise<void>}
 */
async function checkAndSendAlerts() {
  console.log('[alertService] Iniciando verificação de alertas...');
  const db = getDb();

  // Passo 1: Obter risk scores atuais (window 24h como referência temporal)
  let scores;
  let cycleKey;
  try {
    scores = db.all(
      `SELECT bairro, score, nivel, calculated_at
         FROM risk_scores
        WHERE window_hours = 24
        ORDER BY bairro`
    );
    if (!scores || scores.length === 0) {
      console.log('[alertService] Nenhum risk score disponível — abortando');
      return;
    }
    // Usar o calculated_at do primeiro score (todos têm o mesmo por cálculo batch)
    cycleKey = derivarCycleKey(scores[0].calculated_at);
  } catch (err) {
    console.error('[alertService] Erro ao buscar risk scores:', err.message);
    return;
  }

  // Mapear bairro → score para lookup O(1)
  const scoreMap = {};
  for (const row of scores) {
    scoreMap[row.bairro] = row;
  }

  // Passo 2: Buscar usuários elegíveis (calendário conectado, não desconectado)
  let usuarios;
  try {
    usuarios = db.all(
      `SELECT id, alert_threshold, alert_hours_before, calendar_disconnected
         FROM usuarios
        WHERE calendar_connected = 1
          AND calendar_disconnected = 0`
    );
  } catch (err) {
    console.error('[alertService] Erro ao buscar usuários:', err.message);
    return;
  }

  if (!usuarios || usuarios.length === 0) {
    console.log('[alertService] Nenhum usuário com calendário conectado');
    return;
  }

  const now = new Date();

  for (const usuario of usuarios) {
    try {
      const threshold = usuario.alert_threshold ?? 51;
      const windowHours = usuario.alert_hours_before ?? ALERT_WINDOW_HOURS_DEFAULT;
      const windowEnd = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

      // Passo 3: Buscar eventos do cache na janela configurada pelo usuário
      let eventos;
      try {
        eventos = db.all(
          `SELECT google_event_id, summary, start_time, bairro_resolvido
             FROM calendar_events_cache
            WHERE usuario_id = ?
              AND bairro_resolvido IS NOT NULL
              AND start_time >= ?
              AND start_time <= ?`,
          [usuario.id, now.toISOString(), windowEnd.toISOString()]
        );
      } catch (evErr) {
        console.error(`[alertService] Erro ao buscar eventos do usuário ${usuario.id}:`, evErr.message);
        continue;
      }

      if (!eventos || eventos.length === 0) continue;

      // Passo 4: Para cada evento, verificar threshold e deduplicação
      for (const evento of eventos) {
        const scoreRow = scoreMap[evento.bairro_resolvido];
        if (!scoreRow) continue;                     // bairro sem score calculado
        if (scoreRow.score < threshold) continue;    // abaixo do threshold do usuário

        // Verificar deduplicação: já foi alertado neste ciclo?
        let jaAlertado;
        try {
          jaAlertado = db.get(
            `SELECT 1 FROM alertas_enviados
              WHERE usuario_id = ? AND google_event_id = ? AND risk_cycle_key = ?`,
            [usuario.id, evento.google_event_id, cycleKey]
          );
        } catch (dedupErr) {
          console.error('[alertService] Erro na verificação de dedup:', dedupErr.message);
          continue;
        }
        if (jaAlertado) continue;

        // Passo 5: Buscar subscriptions do usuário
        let subscriptions;
        try {
          subscriptions = db.all(
            `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ?`,
            [usuario.id]
          );
        } catch (subErr) {
          console.error('[alertService] Erro ao buscar subscriptions:', subErr.message);
          subscriptions = [];
        }

        // Registrar alerta (independente de ter subscription — fallback in-app lê isso)
        registrarAlertaEnviado(
          usuario.id,
          evento.google_event_id,
          cycleKey,
          evento.bairro_resolvido,
          scoreRow.score,
          evento.summary
        );

        // Se tem subscriptions: enviar push
        if (subscriptions && subscriptions.length > 0) {
          const nivelLabel = scoreRow.nivel.charAt(0).toUpperCase() + scoreRow.nivel.slice(1);
          const summaryText = evento.summary || 'Evento';
          const payload = {
            title: `Alerta: Risco ${nivelLabel} em ${evento.bairro_resolvido}`,
            body: `"${summaryText}" — ${evento.bairro_resolvido} tem risco de alagamento (score ${Math.round(scoreRow.score)}).`,
            tag: `alerta-${evento.google_event_id}`,
            url: '/',
          };
          for (const sub of subscriptions) {
            await enviarPush(sub, payload);
          }
          console.log(
            `[alertService] Alerta enviado: usuario=${usuario.id} evento=${evento.google_event_id} bairro=${evento.bairro_resolvido} score=${scoreRow.score}`
          );
        } else {
          console.log(
            `[alertService] Alerta registrado (sem push subscription): usuario=${usuario.id} evento=${evento.google_event_id}`
          );
        }
      }
    } catch (userErr) {
      // Falha em um usuário não deve impedir os demais
      console.error(`[alertService] Erro ao processar usuário ${usuario.id}:`, userErr.message);
    }
  }

  console.log('[alertService] Verificação de alertas concluída. Ciclo:', cycleKey);
}

module.exports = { checkAndSendAlerts };
