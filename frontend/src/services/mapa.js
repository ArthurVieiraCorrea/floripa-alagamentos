/* global L */

const NIVEL_COR = {
  baixo:   '#22c55e',
  medio:   '#f59e0b',
  alto:    '#ef4444',
  critico: '#7c3aed'
};

const NIVEL_LABEL = {
  baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico'
};

export function iniciarMapa() {
  const map = L.map('map', {
    center: [-27.5954, -48.5480],
    zoom: 12,
    zoomControl: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19
  }).addTo(map);

  return map;
}

export function criarIcone(nivel) {
  const cor = NIVEL_COR[nivel] || '#94a3b8';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22s14-12.667 14-22C28 6.268 21.732 0 14 0z"
      fill="${cor}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="14" cy="14" r="6" fill="#fff" fill-opacity=".85"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -38]
  });
}

export function formatarPopup(o) {
  return `
    <div style="min-width:200px">
      <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${o.bairro}</div>
      <div style="margin-bottom:4px">
        <span style="background:${NIVEL_COR[o.nivel]};color:#fff;padding:2px 8px;border-radius:99px;font-size:.72rem;font-weight:700;text-transform:uppercase">
          ${NIVEL_LABEL[o.nivel] || o.nivel}
        </span>
      </div>
      ${o.descricao ? `<div style="font-size:.8rem;margin-top:6px;color:#94a3b8">${o.descricao}</div>` : ''}
      <div style="font-size:.72rem;color:#64748b;margin-top:8px">${o.criado_em}</div>
    </div>
  `;
}

export function renderizarMarcadores(map, ocorrencias, marcadoresRef) {
  marcadoresRef.forEach(m => m.remove());
  marcadoresRef.length = 0;

  ocorrencias.forEach(o => {
    const marker = L.marker([o.latitude, o.longitude], { icon: criarIcone(o.nivel) })
      .bindPopup(formatarPopup(o));
    marker.addTo(map);
    marcadoresRef.push(marker);
  });
}

// ── Choropleth de Risco ──────────────────────────────────

const RISCO_NIVEL_COR = {
  verde:    '#22c55e',
  amarelo:  '#f59e0b',
  laranja:  '#f97316',
  vermelho: '#ef4444',
  sem_dados: '#cbd5e1'
};

const RISCO_NIVEL_LABEL = {
  verde: 'Verde', amarelo: 'Amarelo', laranja: 'Laranja', vermelho: 'Vermelho'
};

/**
 * Normaliza nome de bairro para join tolerante a acentos e capitalização.
 * Replica exatamente normalizarNome() de backend/src/services/riskEngine.js.
 */
function normalizarNomeLocal(nome) {
  return nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

/**
 * Constrói Map<normalizedName, scoreRow> a partir da resposta da API.
 * @param {Array} scores  — apiResp.scores
 * @returns {Map<string, object>}
 */
function buildScoreMap(scores) {
  return new Map(scores.map(s => [normalizarNomeLocal(s.bairro), s]));
}

/**
 * Formata o popup HTML para um bairro com dados de risco. (D-07)
 * @param {string} nome — NM_BAIRRO do GeoJSON (exibido como está, sem normalização)
 * @param {object} score — linha de risk_scores da API
 * @returns {string} HTML inline
 */
export function formatarPopupBairro(nome, score) {
  const cor = RISCO_NIVEL_COR[score.nivel] || '#94a3b8';
  const label = RISCO_NIVEL_LABEL[score.nivel] || score.nivel;
  const hora = score.calculated_at
    ? new Date(score.calculated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';
  return `
    <div style="min-width:200px">
      <div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${nome}</div>
      <div style="margin-bottom:8px">
        <span style="background:${cor};color:#fff;padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:700">${label}</span>
      </div>
      <div style="font-size:.8rem">Score: ${Number(score.score)}/100</div>
      <div style="font-size:.8rem">Chuva prevista: ${Number(score.precipitacao_prevista_mm)}mm</div>
      <div style="font-size:.8rem">Histórico: ${Number(score.ocorrencias_historicas_count)} ocorrências</div>
      ${score.insufficient_data ? '<div style="color:#f59e0b;font-size:.7rem;margin-top:4px">&#x26A0; Dados limitados</div>' : ''}
      <div style="font-size:.7rem;color:#64748b;margin-top:6px">Atualizado: ${hora}</div>
    </div>
  `;
}

/**
 * Renderiza camada choropleth de risco no mapa. (DASH-01, D-02)
 * - Remove camada anterior se existir (evita acúmulo de layers).
 * - Bairros sem score ficam cinza (#cbd5e1).
 * - Clique em bairro abre popup com dados completos.
 * @param {L.Map} map
 * @param {object} geojson — GeoJSON FeatureCollection de bairros.geojson
 * @param {object} apiResp — Resposta de GET /api/risco/bairros?window=N
 * @param {{ layer: L.GeoJSON|null }} camadaRef — objeto mutável para manter referência
 */
export function renderizarCamadaRisco(map, geojson, apiResp, camadaRef) {
  if (camadaRef.layer) {
    map.removeLayer(camadaRef.layer);
    camadaRef.layer = null;
  }

  const scoreMap = buildScoreMap(apiResp.scores);

  camadaRef.layer = L.geoJSON(geojson, {
    style(feature) {
      const score = scoreMap.get(normalizarNomeLocal(feature.properties.NM_BAIRRO));
      return {
        fillColor: score ? RISCO_NIVEL_COR[score.nivel] : RISCO_NIVEL_COR.sem_dados,
        fillOpacity: 0.65,
        weight: 1,
        color: '#475569',
        opacity: 1
      };
    },
    onEachFeature(feature, layer) {
      const score = scoreMap.get(normalizarNomeLocal(feature.properties.NM_BAIRRO));
      layer.on('click', () => {
        const html = score
          ? formatarPopupBairro(feature.properties.NM_BAIRRO, score)
          : `<div style="min-width:200px"><div style="font-weight:700;font-size:.95rem;margin-bottom:6px">${feature.properties.NM_BAIRRO}</div><div style="font-size:.8rem;color:#94a3b8">Sem dados disponíveis</div></div>`;
        layer.bindPopup(html).openPopup();
      });
    }
  }).addTo(map);
}

/**
 * Remove a camada choropleth do mapa e limpa a referência.
 * @param {L.Map} map
 * @param {{ layer: L.GeoJSON|null }} camadaRef
 */
export function removerCamadaRisco(map, camadaRef) {
  if (camadaRef.layer) {
    map.removeLayer(camadaRef.layer);
    camadaRef.layer = null;
  }
}
