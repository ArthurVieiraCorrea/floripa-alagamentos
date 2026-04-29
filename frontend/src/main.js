import { api } from './services/api.js';
import { iniciarMapa, renderizarMarcadores, renderizarCamadaRisco, removerCamadaRisco, renderizarHeatmap, removerHeatmap } from './services/mapa.js';
import { criarControleToggle, criarControleSeletor, criarControleHeatmap } from './services/controles.js';

// Lista canônica de bairros — espelho de backend/src/constants/bairros.js
// Usada no <select> de associação manual de bairro (CAL-04)
const BAIRROS_CAL = [
  'Canasvieiras', 'Jurerê', 'Daniela', 'Ponta das Canas', 'Cachoeira do Bom Jesus',
  'Ingleses', 'Santinho', 'Rio Vermelho', 'Vargem Grande', 'Vargem Pequena',
  'Barra da Lagoa', 'Lagoa da Conceição', 'Praia Mole', 'São João do Rio Vermelho',
  'Campeche', 'Morro das Pedras', 'Armação', 'Pântano do Sul', 'Ribeirão da Ilha',
  'Tapera', 'Carianos', 'Costeira do Pirajubaé', 'Saco dos Limões',
  'Rio Tavares', 'Itacorubi', 'Trindade', 'Córrego Grande', 'Santa Mônica',
  'Pantanal', 'Serrinha',
  'Centro', 'Agronômica', 'José Mendes', 'Saco Grande', 'João Paulo',
  'Santo Antônio de Lisboa', 'Ratones', 'Sambaqui', 'Cacupé',
  'Estreito', 'Capoeiras', 'Coqueiros', 'Abraão', 'Balneário', 'Coloninha',
  'Monte Cristo', 'Jardim Atlântico', 'Itaguaçu', 'Bom Abrigo', 'Bela Vista',
];

// ── Push notifications ───────────────────────────────────
let swRegistration = null;

// Converte base64url para Uint8Array (obrigatório para PushManager.subscribe)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ── Estado ──────────────────────────────────────────────
const state = {
  marcadores: [],
  tempMarker: null,
  paginaAtual: 1,
  filtros: { nivel: '', bairro: '' },
  // Phase 04 additions
  camadaRisco: { layer: null },   // referência mutável para removeLayer sem acúmulo
  heatmap: { layer: null },       // heatmap de incidentes históricos
  modoAtivo: 'risco',             // 'risco' | 'ocorrencias' — D-03 default: risco
  horizonteAtivo: 24,             // 24 | 48 | 72 — D-05 default: 24h
  geojsonBairros: null,           // cache do fetch de bairros.geojson — fetch uma única vez
  usuario: null,                  // usuário autenticado atual (com alert_threshold)
  paginaAlertas: 1,               // Phase 09 UX-03: paginação independente para aba Alertas
};

// Declarado aqui para estar disponível quando os controles forem inicializados (evita TDZ)
let atualizarTimestamp = () => {};

// ── Mapa ────────────────────────────────────────────────
const map = iniciarMapa();

// ── Controles do mapa ────────────────────────────────────
// D-03: Toggle Risco/Ocorrências
criarControleToggle({
  onModoChange(modo) {
    state.modoAtivo = modo;
    if (modo === 'risco') {
      // D-04: remover marcadores, adicionar choropleth
      state.marcadores.forEach(m => m.remove());
      state.marcadores.length = 0;
      carregarCamadaRisco();
    } else {
      // D-04: remover choropleth, adicionar marcadores
      removerCamadaRisco(map, state.camadaRisco);
      carregarMapa(); // usa a função existente de ocorrências
    }
  }
}).addTo(map);

// D-05: Seletor de Horizonte 24h/48h/72h
const seletor = criarControleSeletor({
  horizonteInicial: 24,
  onHorizonteChange(window) {
    state.horizonteAtivo = window;
    // D-06: re-render choropleth sem recarregar página
    // Seletor só afeta modo 'risco' (D-04 — em modo ocorrências os botões são no-op)
    if (state.modoAtivo === 'risco') {
      carregarCamadaRisco();
    }
  }
});
seletor.controle.addTo(map);
atualizarTimestamp = seletor.atualizarTimestamp;

criarControleHeatmap({
  inicialmenteAtivo: true,
  onToggle(ativo) {
    if (ativo) {
      carregarHeatmap();
    } else {
      removerHeatmap(map, state.heatmap);
      if (_legendaHeatmapCtrl) { map.removeControl(_legendaHeatmapCtrl); _legendaHeatmapCtrl = null; }
    }
  }
}).addTo(map);

// Legenda do heatmap — controle Leaflet injetado uma única vez
let _legendaHeatmapCtrl = null;

function normNome(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

async function carregarHeatmap() {
  try {
    const { pontos, bairros, total } = await api.heatmapOcorrencias();
    renderizarHeatmap(map, pontos, state.heatmap);

    // Correlação: dos top-10 bairros históricos, quantos têm score > 50 agora?
    let correlacaoHtml = '';
    try {
      const riscos = await api.riscos(state.horizonteAtivo);
      const scoreMap = new Map((riscos.scores || []).map(s => [normNome(s.bairro), Number(s.score)]));
      const top10 = bairros.slice(0, 10);
      const coincidentes = top10.filter(b => (scoreMap.get(normNome(b.bairro)) || 0) > 50).length;
      correlacaoHtml = `<div style="margin-top:8px;font-size:.72rem;color:#ffd700;font-weight:600">
        ${coincidentes} de ${top10.length} bairros mais afetados historicamente<br>estão em zona de risco ≥ Laranja agora
      </div>`;
    } catch (_) {}

    // Top-3 bairros
    const top3 = bairros.slice(0, 3).map(b => `<span style="display:flex;justify-content:space-between"><span>${b.bairro}</span><strong>${b.count}</strong></span>`).join('');

    if (_legendaHeatmapCtrl) map.removeControl(_legendaHeatmapCtrl);
    const LegendaCtrl = L.Control.extend({
      options: { position: 'bottomright' },
      onAdd() {
        const div = L.DomUtil.create('div');
        div.style.cssText = 'background:rgba(15,23,42,.88);color:#e2e8f0;padding:10px 13px;border-radius:8px;font-size:.75rem;min-width:190px;line-height:1.5;box-shadow:0 2px 8px rgba(0,0,0,.4)';
        div.innerHTML = `
          <div style="font-weight:700;margin-bottom:6px;font-size:.8rem">🔥 Histórico 2021–2024</div>
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <div style="width:100px;height:10px;border-radius:4px;background:linear-gradient(to right,#ffe066,#ff8c00,#e63c00,#7c0000)"></div>
            <span style="font-size:.68rem;color:#94a3b8">baixo → crítico</span>
          </div>
          <div style="font-size:.7rem;color:#94a3b8;margin-bottom:6px">Total: <strong style="color:#e2e8f0">${total} ocorrências</strong></div>
          <div style="font-size:.72rem;border-top:1px solid #334155;padding-top:6px;display:flex;flex-direction:column;gap:2px">${top3}</div>
          ${correlacaoHtml}`;
        L.DomEvent.disableClickPropagation(div);
        return div;
      }
    });
    _legendaHeatmapCtrl = new LegendaCtrl();
    _legendaHeatmapCtrl.addTo(map);
  } catch (e) {
    console.error('Erro ao carregar heatmap histórico', e);
  }
}

map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  document.getElementById('lat').value = lat.toFixed(6);
  document.getElementById('lng').value = lng.toFixed(6);

  if (state.tempMarker) state.tempMarker.remove();
  state.tempMarker = window.L.marker([lat, lng], {
    icon: window.L.divIcon({
      html: '<div class="temp-marker-icon"></div>',
      className: '',
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    })
  }).addTo(map).bindPopup('Nova ocorrência aqui').openPopup();
});

// ── Stats ───────────────────────────────────────────────
async function carregarStats() {
  try {
    const s = await api.estatisticas();
    document.getElementById('stat-total').textContent    = s.total;
    document.getElementById('stat-critico').textContent  = s.critico;
    document.getElementById('stat-alto').textContent     = s.alto;
    document.getElementById('stat-medio').textContent    = s.medio;
    document.getElementById('stat-baixo').textContent    = s.baixo;
    document.getElementById('stat-bairros').textContent  = s.bairros_afetados;
  } catch (e) {
    console.error('Erro ao carregar stats', e);
  }
}

// ── Mapa: ocorrências recentes ──────────────────────────
async function carregarMapa() {
  try {
    const recentes = await api.ocorrenciasRecentes(24);
    renderizarMarcadores(map, recentes, state.marcadores);
  } catch (e) {
    console.error('Erro ao carregar mapa', e);
  }
}

// ── Mapa: camada de risco ───────────────────────────────

async function carregarCamadaRisco() {
  try {
    // Usar Promise.all para buscar GeoJSON (cacheado) e scores em paralelo
    // GeoJSON já cacheado: retorna direto sem refetch
    const [geojson, apiResp] = await Promise.all([
      state.geojsonBairros
        ? Promise.resolve(state.geojsonBairros)
        : fetch('/bairros.geojson').then(r => {
            if (!r.ok) throw new Error(`GeoJSON HTTP ${r.status}`);
            return r.json();
          }).then(data => { state.geojsonBairros = data; return data; }),
      api.riscos(state.horizonteAtivo)
    ]);
    renderizarCamadaRisco(map, geojson, apiResp, state.camadaRisco);

    // D-08: atualizar timestamp no controle de horizonte
    // calculated_at vem da primeira linha de scores (todos têm o mesmo timestamp por cálculo batch)
    if (apiResp.scores && apiResp.scores.length > 0 && apiResp.scores[0].calculated_at) {
      const hora = new Date(apiResp.scores[0].calculated_at).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit'
      });
      atualizarTimestamp(`Atualizado: ${hora}`);
    } else {
      atualizarTimestamp('Calculando...');
    }
  } catch (e) {
    if (e.status === 503) {
      // Estado esperado antes do primeiro cálculo do cron — renderiza tudo cinza
      // Garantir GeoJSON carregado mesmo no cold-start (Promise.all pode ter falhado na parte de scores)
      if (!state.geojsonBairros) {
        try {
          state.geojsonBairros = await fetch('/bairros.geojson').then(r => r.json());
        } catch (_) { /* GeoJSON indisponível — não renderiza cinza */ }
      }
      if (state.geojsonBairros) {
        renderizarCamadaRisco(map, state.geojsonBairros, { scores: [] }, state.camadaRisco);
      }
      atualizarTimestamp('Calculando...');
      console.info('Risk scores ainda calculando — renderizando bairros sem dados');
    } else {
      atualizarTimestamp('Erro ao carregar dados de risco. Recarregue a página.');
      console.error('Erro ao carregar camada de risco', e);
    }
  }
}

// ── Histórico / lista ───────────────────────────────────
const NIVEL_LABEL = { baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico' };

function formatarData(str) {
  const d = new Date(str.replace(' ', 'T'));
  return d.toLocaleString('pt-BR');
}

function renderizarLista(dados, paginacao) {
  const lista = document.getElementById('lista-ocorrencias');
  const pag   = document.getElementById('paginacao');

  if (!dados.length) {
    lista.innerHTML = '<p class="loading">Nenhuma ocorrência encontrada.</p>';
    pag.innerHTML = '';
    return;
  }

  lista.innerHTML = dados.map(o => `
    <div class="card-ocorrencia nivel-${o.nivel}" data-lat="${o.latitude}" data-lng="${o.longitude}" data-id="${o.id}">
      <div class="card-top">
        <span class="card-bairro">${o.bairro}</span>
        <span class="badge badge-${o.nivel}">${NIVEL_LABEL[o.nivel] || o.nivel}</span>
        ${state.usuario ? `<button class="btn-deletar" data-id="${o.id}" title="Deletar ocorrência">✕</button>` : ''}
      </div>
      ${o.descricao ? `<div class="card-desc">${o.descricao}</div>` : ''}
      <div class="card-data">${formatarData(o.criado_em)}</div>
    </div>
  `).join('');

  // Click no card -> voa para o ponto no mapa
  lista.querySelectorAll('.card-ocorrencia').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.btn-deletar')) return;
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      map.flyTo([lat, lng], 16, { duration: 1 });
      state.marcadores.forEach(m => {
        const ll = m.getLatLng();
        if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) {
          m.openPopup();
        }
      });
    });
  });

  // Click no botão deletar
  lista.querySelectorAll('.btn-deletar').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(btn.dataset.id);
      if (!confirm('Deletar esta ocorrência?')) return;
      try {
        await api.deletarOcorrencia(id);
        await Promise.all([carregarStats(), carregarHistorico()]);
        if (state.modoAtivo === 'ocorrencias') carregarMapa();
      } catch (err) {
        alert(`Erro ao deletar: ${err.message}`);
      }
    });
  });

  // Paginação
  const totalPags = paginacao.paginas;
  if (totalPags <= 1) { pag.innerHTML = ''; return; }

  pag.innerHTML = Array.from({ length: totalPags }, (_, i) => i + 1)
    .map(p => `<button class="${p === state.paginaAtual ? 'active' : ''}" data-p="${p}">${p}</button>`)
    .join('');

  pag.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.paginaAtual = parseInt(btn.dataset.p);
      carregarHistorico();
    });
  });
}

async function carregarHistorico() {
  const lista = document.getElementById('lista-ocorrencias');
  lista.innerHTML = '<p class="loading">Carregando...</p>';
  try {
    const resp = await api.listarOcorrencias({
      ...state.filtros,
      pagina: state.paginaAtual,
      limite: 20
    });
    renderizarLista(resp.dados, resp.paginacao);
  } catch (e) {
    lista.innerHTML = `<p class="loading" style="color:#fca5a5">Erro: ${e.message}</p>`;
  }
}

// ── Form de registro ────────────────────────────────────
document.getElementById('form-ocorrencia').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn  = form.querySelector('button[type=submit]');
  const msg  = document.getElementById('form-msg');

  msg.className = 'form-msg';
  msg.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const lat = parseFloat(form.latitude.value);
  const lng = parseFloat(form.longitude.value);

  // Validação de bounds — coordenadas devem estar dentro da região de Florianópolis
  const dentroDeFloripa = lat >= -27.9 && lat <= -27.3 && lng >= -48.9 && lng <= -48.2;
  if (!dentroDeFloripa) {
    msg.className = 'form-msg error';
    msg.textContent = 'Coordenadas fora de Florianópolis. Clique no mapa para definir o ponto.';
    btn.disabled = false;
    btn.textContent = 'Registrar Ocorrência';
    return;
  }

  const data = {
    latitude:   lat,
    longitude:  lng,
    bairro:     form.bairro.value,
    nivel:      form.nivel.value,
    descricao:  form.descricao.value
  };

  try {
    await api.criarOcorrencia(data);
    msg.className = 'form-msg success';
    msg.textContent = 'Ocorrência registrada com sucesso!';
    form.reset();
    if (state.tempMarker) { state.tempMarker.remove(); state.tempMarker = null; }
    await Promise.all([carregarMapa(), carregarStats(), carregarHistorico()]);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Registrar Ocorrência';
    setTimeout(() => { msg.className = 'form-msg'; msg.textContent = ''; }, 4000);
  }
});

// ── Tabs ────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'historico') carregarHistorico();
    if (tab.dataset.tab === 'calendario') verificarAlertasPendentes(); // D-04: re-checar ao abrir aba
    if (tab.dataset.tab === 'status') carregarStatus();
    if (tab.dataset.tab === 'alertas') {
      state.paginaAlertas = 1;
      carregarHistoricoAlertas();
    }
  });
});

// ── Filtros ─────────────────────────────────────────────
document.getElementById('btn-filtrar').addEventListener('click', () => {
  state.filtros.nivel  = document.getElementById('filtro-nivel').value;
  state.filtros.bairro = document.getElementById('filtro-bairro').value;
  state.paginaAtual = 1;
  carregarHistorico();
});

// ── Calendário Google ────────────────────────────────────

/**
 * Formata data ISO 8601 para exibição em pt-BR.
 * @param {string} iso
 * @returns {string} ex: "qui, 10/04 às 14:30"
 */
function formatarDataEvento(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

/**
 * Renderiza lista de eventos do calendário no #lista-eventos-cal.
 * Eventos com bairro resolvido mostram o bairro.
 * Eventos sem bairro resolvido mostram <select> com BAIRROS_CAL (CAL-04).
 * @param {Array} eventos
 */
function renderizarEventos(eventos) {
  const lista = document.getElementById('lista-eventos-cal');

  if (!eventos.length) {
    lista.innerHTML = '<p class="hint">Nenhum evento nas próximas 72h.</p>';
    return;
  }

  lista.innerHTML = eventos.map(ev => {
    const summaryEscaped  = String(ev.summary  || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const locationEscaped = String(ev.location || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const bairroHtml = ev.bairro_resolvido
      ? `<span class="cal-bairro resolvido">${ev.bairro_resolvido}</span>`
      : `<select class="cal-select-bairro" data-event-id="${ev.google_event_id}">
           <option value="">Associar bairro...</option>
           ${BAIRROS_CAL.map(b => `<option value="${b}">${b}</option>`).join('')}
         </select>`;

    const locationHtml = ev.location
      ? `<div class="cal-location">${locationEscaped}</div>`
      : '';

    return `
      <div class="calendario-evento" data-event-id="${ev.google_event_id}">
        <div class="cal-summary">${summaryEscaped || '(Sem título)'}</div>
        <div class="cal-start">${formatarDataEvento(ev.start_time)}</div>
        ${locationHtml}
        <div class="cal-bairro-row">${bairroHtml}</div>
      </div>
    `;
  }).join('');

  // Listener para seletor de bairro manual (CAL-04)
  lista.querySelectorAll('.cal-select-bairro').forEach(sel => {
    sel.addEventListener('change', async () => {
      const bairro = sel.value;
      if (!bairro) return;
      const googleEventId = sel.dataset.eventId;
      sel.disabled = true;
      try {
        await api.atualizarBairroEvento(googleEventId, bairro);
        // Recarregar lista para refletir o bairro salvo
        await carregarCalendario();
      } catch (err) {
        console.error('[calendar] Erro ao associar bairro:', err.message);
        sel.disabled = false;
      }
    });
  });
}

/**
 * Carrega e exibe o estado atual do calendário para o usuário autenticado.
 * Controla visibilidade dos 4 estados: nao-autenticado, banner, nao-conectado, conectado.
 * @param {{ calendar_connected: number, calendar_disconnected: number }|null} usuario
 */
async function carregarCalendario(usuario) {
  const elNaoAuth   = document.getElementById('cal-nao-autenticado');
  const elNaoCon    = document.getElementById('cal-nao-conectado');
  const elConectado = document.getElementById('cal-conectado');
  const elBanner    = document.getElementById('banner-cal-desconectado');

  // Ocultar tudo antes de decidir o estado
  elNaoAuth.style.display   = 'none';
  elNaoCon.style.display    = 'none';
  elConectado.style.display = 'none';
  elBanner.style.display    = 'none';

  if (!usuario) {
    elNaoAuth.style.display = 'block';
    return;
  }

  // Banner de reconexão (invalid_grant)
  if (usuario.calendar_disconnected === 1) {
    elBanner.style.display = 'flex';
    elNaoCon.style.display = 'block';
    return;
  }

  if (!usuario.calendar_connected) {
    elNaoCon.style.display = 'block';
    return;
  }

  // Conectado: buscar e renderizar eventos
  elConectado.style.display = 'block';
  const lista = document.getElementById('lista-eventos-cal');
  lista.innerHTML = '<p class="loading">Carregando eventos...</p>';
  try {
    const { eventos } = await api.listarEventosCalendario();
    renderizarEventos(eventos);
  } catch (err) {
    lista.innerHTML = `<p class="hint" style="color:#fca5a5">Erro ao carregar eventos: ${err.message}</p>`;
  }

  // D-01, D-03: exibir seção Notificações e verificar status push
  document.getElementById('secao-notificacoes').style.display = 'block';
  verificarStatusPush(usuario?.alert_threshold || 51, usuario?.alert_hours_before ?? 24);
}

// ── Calendar: connect / disconnect ──────────────────────

document.getElementById('btn-conectar-cal').addEventListener('click', async () => {
  const btn = document.getElementById('btn-conectar-cal');
  const msg = document.getElementById('cal-connect-msg');
  btn.disabled = true;
  btn.textContent = 'Conectando...';
  msg.className = 'form-msg';
  msg.textContent = '';
  try {
    await api.conectarCalendario();
    await carregarSessao();
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
    btn.disabled = false;
    btn.textContent = 'Conectar Calendário';
  }
});

document.getElementById('btn-reconectar-cal').addEventListener('click', async () => {
  document.getElementById('btn-reconectar-cal').disabled = true;
  try {
    await api.conectarCalendario();
    await carregarSessao();
  } catch (err) {
    console.error('[calendar] Erro ao reconectar:', err.message);
    document.getElementById('btn-reconectar-cal').disabled = false;
  }
});

document.getElementById('btn-desconectar-cal').addEventListener('click', async () => {
  if (!confirm('Desconectar o Google Calendar? Seus eventos salvos serão removidos do cache.')) return;
  const btn = document.getElementById('btn-desconectar-cal');
  btn.disabled = true;
  try {
    await api.desconectarCalendario();
    await carregarSessao();
  } catch (err) {
    console.error('[calendar] Erro ao desconectar:', err.message);
    btn.disabled = false;
  }
});

// ── Status do sistema (UX-02) ────────────────────────────
async function carregarStatus() {
  // Forecast freshness — chama API (já cacheada pelo browser, custo baixo)
  const dotF = document.getElementById('status-dot-forecast');
  const detF = document.getElementById('status-detalhe-forecast');
  try {
    const data = await api.previsao.atual();
    if (data?.stale) {
      dotF.style.color = '#ef4444';  // --risco-vermelho
      const mins = data.last_updated
        ? Math.round((Date.now() - new Date(data.last_updated + 'Z')) / 60000)
        : '?';
      const horas = Math.floor(mins / 60);
      const resto = mins % 60;
      detF.textContent = `Desatualizado (há ${horas > 0 ? horas + 'h' : ''}${resto}min)`;
    } else {
      dotF.style.color = '#22c55e';  // --risco-verde
      detF.textContent = 'Atualizado';
    }
  } catch {
    dotF.style.color = '#94a3b8';  // --text-muted
    detF.textContent = 'Indisponível';
  }

  // Calendar connection — derivado de state.usuario (já populado por carregarSessao)
  const dotC = document.getElementById('status-dot-calendar');
  const detC = document.getElementById('status-detalhe-calendar');
  const u = state.usuario;
  if (u?.calendar_connected === 1 && u?.calendar_disconnected !== 1) {
    dotC.style.color = '#22c55e';
    detC.textContent = 'Conectado';
  } else if (u?.calendar_disconnected === 1) {
    dotC.style.color = '#ef4444';
    detC.textContent = 'Desconectado (token expirado)';
  } else {
    dotC.style.color = '#f59e0b';  // --risco-amarelo
    detC.textContent = 'Não conectado';
  }

  // Push status — consulta subscription em tempo real
  const dotP = document.getElementById('status-dot-push');
  const detP = document.getElementById('status-detalhe-push');
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    dotP.style.color = '#94a3b8';
    detP.textContent = 'Não suportado pelo browser';
  } else if (Notification.permission === 'denied') {
    dotP.style.color = '#ef4444';
    detP.textContent = 'Bloqueado pelo browser';
  } else if (swRegistration) {
    const sub = await swRegistration.pushManager.getSubscription();
    dotP.style.color = sub ? '#22c55e' : '#f59e0b';
    detP.textContent = sub ? 'Ativo' : 'Inativo';
  } else {
    dotP.style.color = '#f59e0b';
    detP.textContent = 'Inativo';
  }
}

// ── Histórico de alertas (UX-03) ─────────────────────────
async function carregarHistoricoAlertas() {
  const lista = document.getElementById('lista-alertas');
  const pag   = document.getElementById('paginacao-alertas');
  lista.innerHTML = '<p class="loading">Carregando...</p>';
  try {
    const resp = await api.alertas.historico(state.paginaAlertas);
    renderizarListaAlertas(resp.alertas, resp.paginacao);
  } catch (e) {
    lista.innerHTML = `<p class="loading" style="color:#fca5a5">Erro: ${e.message}</p>`;
    pag.innerHTML = '';
  }
}

function renderizarListaAlertas(alertas, paginacao) {
  const lista = document.getElementById('lista-alertas');
  const pag   = document.getElementById('paginacao-alertas');

  if (!alertas.length) {
    lista.innerHTML = '<p class="loading">Você ainda não recebeu alertas.</p>';
    pag.innerHTML = '';
    return;
  }

  lista.innerHTML = alertas.map(a => `
    <div class="card-alerta">
      <div class="card-top">
        <span class="card-bairro">${String(a.bairro || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
        <span class="card-data">${formatarData(a.enviado_em)}</span>
      </div>
      ${a.summary ? `<div class="card-desc">${String(a.summary).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : ''}
    </div>
  `).join('');

  const totalPags = paginacao.paginas;
  if (totalPags <= 1) { pag.innerHTML = ''; return; }

  pag.innerHTML = Array.from({ length: totalPags }, (_, i) => i + 1)
    .map(p => `<button class="${p === state.paginaAlertas ? 'active' : ''}" data-p="${p}">${p}</button>`)
    .join('');

  pag.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.paginaAlertas = parseInt(btn.dataset.p);
      carregarHistoricoAlertas();
    });
  });
}

// ── Onboarding Wizard (Phase 10, UX-04) ─────────────────

function fecharWizard() {
  document.getElementById('wizard-backdrop')?.remove();
}

// Ativa push notifications. Usada pelo btn-push-optin e pelo wizard (passo 3).
// feedbackEl: elemento DOM onde exibir mensagens de sucesso/erro (role="status" ou "alert")
// btnEl: botão de ação do passo (para desabilitar durante loading e remover após sucesso)
async function ativarPushNotificacoes(feedbackEl, btnEl) {
  feedbackEl.textContent = '';
  feedbackEl.className = 'wizard-feedback';

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    feedbackEl.className = 'wizard-feedback form-msg error';
    feedbackEl.setAttribute('role', 'alert');
    feedbackEl.textContent = 'Browser não suporta notificações push.';
    return;
  }
  if (Notification.permission === 'denied') {
    feedbackEl.className = 'wizard-feedback form-msg error';
    feedbackEl.setAttribute('role', 'alert');
    feedbackEl.textContent = 'Permissão de notificações bloqueada no browser. Acesse as configurações do navegador para liberar e tente novamente.';
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = 'Ativando...';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      feedbackEl.className = 'wizard-feedback form-msg error';
      feedbackEl.setAttribute('role', 'alert');
      feedbackEl.textContent = 'Permissão de notificações bloqueada no browser. Acesse as configurações do navegador para liberar e tente novamente.';
      btnEl.disabled = false;
      btnEl.textContent = 'Ativar notificações';
      return;
    }

    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    const { publicKey: VAPID_PUBLIC_KEY } = await api.push.getVapidPublicKey();
    if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY não configurada no servidor');

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await api.push.subscribe(subscription.toJSON());
    feedbackEl.className = 'wizard-feedback form-msg success';
    feedbackEl.setAttribute('role', 'status');
    feedbackEl.textContent = 'Notificações ativadas.';
    btnEl.style.display = 'none'; // some após sucesso (conforme UI-SPEC)
    atualizarStatusPush('ativo', state.usuario?.alert_threshold || 51, state.usuario?.alert_hours_before ?? 24);
  } catch (err) {
    feedbackEl.className = 'wizard-feedback form-msg error';
    feedbackEl.setAttribute('role', 'alert');
    feedbackEl.textContent = 'Não foi possível ativar. Você pode tentar novamente na aba Calendário.';
    btnEl.disabled = false;
    btnEl.textContent = 'Ativar notificações';
  }
}

function abrirWizard() {
  // Não abrir se já estiver aberto
  if (document.getElementById('wizard-backdrop')) return;

  const PASSOS = [
    {
      titulo: 'Bem-vindo ao Floripa Alagamentos',
      desc: 'Este app monitora o risco de alagamento em tempo real nos bairros de Florianópolis e avisa você antes de ir a um lugar que pode estar alagado. Nos próximos 2 passos você conecta seu calendário e ativa os alertas.',
      btnProximo: 'Próximo',
      temAcao: false,
    },
    {
      titulo: 'Conecte seu Google Calendar',
      desc: 'O app verifica seus eventos das próximas 72h e calcula o risco de alagamento nos bairros onde eles acontecem. Seu calendário nunca é modificado.',
      btnProximo: 'Próximo',
      temAcao: true,
      btnAcaoTexto: 'Conectar Calendário',
    },
    {
      titulo: 'Ative as notificações push',
      desc: 'Receba alertas no seu dispositivo quando um evento do seu calendário cair em um bairro com risco elevado — mesmo com o app fechado.',
      btnProximo: 'Concluir',
      temAcao: true,
      btnAcaoTexto: 'Ativar notificações',
    },
  ];

  let passoAtual = 0; // índice 0-based

  function renderizarPasso() {
    const passo = PASSOS[passoAtual];
    const n = passoAtual + 1; // número 1-based para exibição

    // Atualizar dots
    const dots = document.querySelectorAll('.wizard-dot');
    dots.forEach((dot, i) => {
      dot.className = 'wizard-dot';
      if (i < passoAtual) dot.classList.add('visitado');
      else if (i === passoAtual) dot.classList.add('ativo');
    });

    // Atualizar label de progresso
    document.querySelector('.wizard-progress-label').textContent = `Passo ${n} de 3`;

    // Atualizar título e descrição
    document.getElementById('wizard-title').textContent = passo.titulo;
    document.querySelector('.wizard-desc').textContent = passo.desc;

    // Atualizar botão próximo/concluir
    document.getElementById('wizard-btn-proximo').textContent = passo.btnProximo;

    // Atualizar área de ação
    const actionArea = document.querySelector('.wizard-action-area');
    actionArea.innerHTML = '';
    const feedbackEl = document.querySelector('.wizard-feedback');
    feedbackEl.textContent = '';
    feedbackEl.className = 'wizard-feedback';

    if (passo.temAcao) {
      const btnAcao = document.createElement('button');
      btnAcao.className = 'btn-primary';
      btnAcao.style.cssText = 'margin-bottom: 12px;';
      btnAcao.textContent = passo.btnAcaoTexto;

      if (passoAtual === 1) {
        // Passo 2: Conectar Calendar
        btnAcao.addEventListener('click', async () => {
          btnAcao.disabled = true;
          btnAcao.textContent = 'Conectando...';
          try {
            await api.conectarCalendario();
            feedbackEl.className = 'wizard-feedback form-msg success';
            feedbackEl.setAttribute('role', 'status');
            feedbackEl.textContent = 'Calendário conectado com sucesso.';
            btnAcao.style.display = 'none'; // some após sucesso
            // NÃO chamar carregarSessao() aqui — fecharia o modal
            if (state.usuario) state.usuario.calendar_connected = 1;
          } catch (err) {
            feedbackEl.className = 'wizard-feedback form-msg error';
            feedbackEl.setAttribute('role', 'alert');
            if (err.status === 401 || (err.message && err.message.includes('permissão'))) {
              feedbackEl.textContent = 'Permissão de calendário não foi concedida no login. Saia e entre novamente para autorizar.';
            } else {
              feedbackEl.textContent = 'Não foi possível conectar. Você pode tentar novamente na aba Calendário.';
            }
            btnAcao.disabled = false;
            btnAcao.textContent = 'Conectar Calendário';
          }
        });
      } else if (passoAtual === 2) {
        // Passo 3: Ativar Push
        btnAcao.addEventListener('click', () => {
          ativarPushNotificacoes(feedbackEl, btnAcao);
        });
      }

      actionArea.appendChild(btnAcao);
    }
  }

  // ── Construir HTML do backdrop + modal ────────────────
  const backdrop = document.createElement('div');
  backdrop.id = 'wizard-backdrop';
  backdrop.innerHTML = `
    <div id="wizard-modal" role="dialog" aria-modal="true" aria-labelledby="wizard-title" tabindex="-1">
      <div class="wizard-header">
        <div class="wizard-progress">
          <div class="wizard-dot ativo"></div>
          <div class="wizard-dot"></div>
          <div class="wizard-dot"></div>
          <span class="wizard-progress-label">Passo 1 de 3</span>
        </div>
        <h2 id="wizard-title"></h2>
      </div>
      <div class="wizard-body">
        <p class="wizard-desc"></p>
        <div class="wizard-action-area"></div>
        <div class="wizard-feedback" role="status"></div>
      </div>
      <div class="wizard-footer">
        <button id="wizard-btn-pular">Pular configuração</button>
        <button id="wizard-btn-proximo">Próximo</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const modal = document.getElementById('wizard-modal');
  modal.focus();

  // ── Shake ao clicar fora ────────────────────────────
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      modal.classList.add('shaking');
      modal.addEventListener('animationend', () => modal.classList.remove('shaking'), { once: true });
    }
  });

  // ── Escape não fecha ────────────────────────────────
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modal.classList.add('shaking');
      modal.addEventListener('animationend', () => modal.classList.remove('shaking'), { once: true });
      return;
    }
    // Focus trap
    if (e.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll(
      'button:not([disabled]):not([style*="display: none"]):not([style*="display:none"]), [tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // ── Botão Pular ─────────────────────────────────────
  document.getElementById('wizard-btn-pular').addEventListener('click', async () => {
    fecharWizard();
    try {
      await api.usuarios.setOnboardingDone();
    } catch (_) {
      // Degradação silenciosa: wizard pode reaparecer no próximo login
    }
  });

  // ── Botão Próximo / Concluir ─────────────────────────
  document.getElementById('wizard-btn-proximo').addEventListener('click', async () => {
    if (passoAtual < PASSOS.length - 1) {
      passoAtual++;
      renderizarPasso();
    } else {
      // Passo 3: Concluir — gravar flag e fechar
      fecharWizard();
      try {
        await api.usuarios.setOnboardingDone();
      } catch (_) {
        // Degradação silenciosa
      }
    }
  });

  // Renderizar o primeiro passo
  renderizarPasso();
}

// ── Sessão / Auth ────────────────────────────────────────
async function carregarSessao() {
  try {
    const usuario = await api.sessao();
    const btnLogin  = document.getElementById('btn-login');
    const userInfo  = document.getElementById('user-info');
    const userNome  = document.getElementById('user-nome');

    state.usuario = usuario || null;
    if (usuario) {
      state.usuario = usuario;
      btnLogin.style.display  = 'none';
      userInfo.style.display  = 'flex';
      userNome.textContent    = usuario.nome || usuario.email;
      document.getElementById('tab-btn-admin').style.display = 'inline-block';
      document.getElementById('tab-btn-status').style.display = 'inline-block';
      document.getElementById('tab-btn-alertas').style.display = 'inline-block';
      // Onboarding wizard: abrir se usuário ainda não completou (UX-04, D-03)
      if (!usuario.onboarding_done) {
        abrirWizard();
      }
      await carregarCalendario(usuario);
    } else {
      state.usuario = null;
      btnLogin.style.display  = 'inline-block';
      userInfo.style.display  = 'none';
      document.getElementById('tab-btn-admin').style.display = 'none';
      document.getElementById('tab-btn-status').style.display = 'none';
      document.getElementById('tab-btn-alertas').style.display = 'none';
      carregarCalendario(null);
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err.message);
    // Fallback: mostrar botão de login para que o usuário possa tentar autenticar
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.style.display = 'inline-block';
  }
}

// ── Push UI ──────────────────────────────────────────────

/**
 * Atualiza indicador de status push e exibe botões corretos.
 * @param {'ativo'|'inativo'|'negado'|'sem-suporte'} status
 * @param {number} [threshold] — alert_threshold do usuário para pré-selecionar o <select>
 */
function atualizarStatusPush(status, threshold, hoursBeforeArg) {
  const icon  = document.getElementById('push-status-icon');
  const texto = document.getElementById('push-status-texto');
  const btnOn   = document.getElementById('btn-push-optin');
  const btnOff  = document.getElementById('btn-push-optout');
  const btnTest = document.getElementById('btn-push-test');
  const thRow  = document.getElementById('push-threshold-row');
  const hoursRow = document.getElementById('push-hours-row');

  btnOn.style.display    = 'none';
  btnOff.style.display   = 'none';
  btnTest.style.display  = 'none';
  thRow.style.display    = 'none';
  hoursRow.style.display = 'none';

  if (status === 'ativo') {
    icon.style.color  = '#22c55e';
    texto.textContent = 'Notificações push ativas';
    btnOff.style.display   = 'inline-block';
    btnTest.style.display  = 'inline-block';
    thRow.style.display    = 'flex';
    hoursRow.style.display = 'flex';
    if (threshold !== undefined) {
      const sel = document.getElementById('sel-threshold');
      if (sel) sel.value = String(threshold);
    }
    if (hoursBeforeArg !== undefined) {
      const selH = document.getElementById('sel-alert-hours');
      if (selH) selH.value = String(hoursBeforeArg);
    }
  } else if (status === 'negado') {
    icon.style.color  = '#ef4444';
    texto.textContent = 'Notificações bloqueadas pelo browser. Habilite nas configurações.';
  } else if (status === 'sem-suporte') {
    icon.style.color  = '#6b7280';
    texto.textContent = 'Seu browser não suporta notificações push.';
  } else {
    // inativo
    icon.style.color  = '#f59e0b';
    texto.textContent = 'Notificações push inativas';
    btnOn.style.display = 'inline-block';
  }
}

/**
 * Verifica se o usuário já tem subscription ativa e atualiza a UI.
 * Chamado ao renderizar o estado "conectado".
 * @param {number} [threshold] — alert_threshold do usuário
 * @param {number} [hoursBefore] — alert_hours_before do usuário
 */
async function verificarStatusPush(threshold, hoursBefore) {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    atualizarStatusPush('sem-suporte');
    return;
  }
  if (Notification.permission === 'denied') {
    atualizarStatusPush('negado');
    return;
  }
  if (!swRegistration) {
    atualizarStatusPush('inativo', threshold, hoursBefore);
    return;
  }
  const sub = await swRegistration.pushManager.getSubscription();
  atualizarStatusPush(sub ? 'ativo' : 'inativo', threshold, hoursBefore);
}

// ── Alertas in-app (ALERT-05) ────────────────────────────

// Chave localStorage: IDs de alertas fechados na sessão atual (D-06)
// Banner não reaparece na mesma sessão após fechar.
// Re-aparece na próxima sessão se ainda pendentes no servidor (D-05).
const ALERTAS_FECHADOS_KEY = 'floripa_alertas_fechados';

/**
 * Retorna conjunto de IDs de alertas fechados na sessão atual.
 * @returns {Set<number>}
 */
function getAlertasFechadosNaSessao() {
  try {
    const raw = sessionStorage.getItem(ALERTAS_FECHADOS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (_) {
    return new Set();
  }
}

/**
 * Marca um conjunto de IDs como fechados na sessão (sessionStorage).
 * @param {number[]} ids
 */
function marcarFechadosNaSessao(ids) {
  try {
    const fechados = getAlertasFechadosNaSessao();
    ids.forEach(id => fechados.add(id));
    sessionStorage.setItem(ALERTAS_FECHADOS_KEY, JSON.stringify([...fechados]));
  } catch (_) { /* sessionStorage indisponível — ignorar */ }
}

/**
 * Exibe ou oculta o banner de alertas in-app com base nos alertas pendentes.
 * Filtra alertas já fechados nesta sessão (sessionStorage).
 * Se todos os alertas pendentes foram fechados na sessão: oculta banner.
 * @param {{ id: number, bairro: string, score: number, summary: string|null }[]} alertas
 */
function atualizarBannerAlertas(alertas) {
  const banner = document.getElementById('banner-alertas');
  if (!banner) return;

  if (!alertas || alertas.length === 0) {
    banner.style.display = 'none';
    return;
  }

  const fechadosNaSessao = getAlertasFechadosNaSessao();
  const visiveis = alertas.filter(a => !fechadosNaSessao.has(a.id));

  if (visiveis.length === 0) {
    banner.style.display = 'none';
    return;
  }

  // Montar texto do banner com os alertas visíveis
  const textoEl = document.getElementById('banner-alertas-texto');
  if (textoEl) {
    if (visiveis.length === 1) {
      const a = visiveis[0];
      const nivelLabel = a.score >= 76 ? 'Vermelho' : a.score >= 51 ? 'Laranja' : a.score >= 26 ? 'Amarelo' : 'Verde';
      const summary = a.summary ? `"${a.summary}" em ` : 'Evento em ';
      textoEl.textContent = `${summary}${a.bairro} — risco ${nivelLabel} (score ${Math.round(a.score)}).`;
    } else {
      const bairros = [...new Set(visiveis.map(a => a.bairro))].join(', ');
      textoEl.textContent = `${visiveis.length} eventos em áreas de risco: ${bairros}.`;
    }
  }

  banner.style.display = 'flex';
}

/**
 * Polling: verifica alertas pendentes e atualiza banner.
 * Chamado pelo setInterval de 60s existente e na inicialização.
 * Silencioso em caso de erro (usuário não autenticado retorna 401 — ignorado).
 */
async function verificarAlertasPendentes() {
  if (!state.usuario) return;  // não autenticado: skip silencioso
  try {
    const { alertas } = await api.alertas.pendentes();
    atualizarBannerAlertas(alertas);
  } catch (err) {
    if (err.status !== 401) {
      console.error('[alertas] Erro ao verificar pendentes:', err.message);
    }
  }
}

// Ativar push (D-02, ALERT-01)
document.getElementById('btn-push-optin').addEventListener('click', async () => {
  const btn = document.getElementById('btn-push-optin');
  const msg = document.getElementById('push-msg');
  msg.textContent = '';

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    msg.className = 'form-msg error';
    msg.textContent = 'Browser não suporta push.';
    return;
  }
  if (Notification.permission === 'denied') {
    msg.className = 'form-msg error';
    msg.textContent = 'Notificações bloqueadas. Habilite nas configurações do browser.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Solicitando permissão...';

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      msg.className = 'form-msg error';
      msg.textContent = 'Permissão não concedida.';
      btn.disabled = false;
      btn.textContent = 'Ativar notificações push';
      return;
    }

    if (!swRegistration) {
      swRegistration = await navigator.serviceWorker.ready;
    }

    const { publicKey: VAPID_PUBLIC_KEY } = await api.push.getVapidPublicKey();
    if (!VAPID_PUBLIC_KEY) throw new Error('VAPID_PUBLIC_KEY não configurada no servidor');

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    await api.push.subscribe(subscription.toJSON());
    msg.className = 'form-msg success';
    msg.textContent = 'Notificações push ativadas!';
    atualizarStatusPush('ativo', state.usuario?.alert_threshold || 51, state.usuario?.alert_hours_before ?? 24);
    setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 3000);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = `Erro: ${err.message}`;
    btn.disabled = false;
    btn.textContent = 'Ativar notificações push';
  }
});

// Desativar push
document.getElementById('btn-push-optout').addEventListener('click', async () => {
  const btn = document.getElementById('btn-push-optout');
  btn.disabled = true;
  try {
    if (swRegistration) {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) {
        await api.push.unsubscribe(sub.endpoint);
        await sub.unsubscribe();
      }
    }
    atualizarStatusPush('inativo');
  } catch (err) {
    console.error('[push] Erro ao desativar:', err.message);
    btn.disabled = false;
  }
});

// Testar notificação push
document.getElementById('btn-push-test').addEventListener('click', async () => {
  const btn = document.getElementById('btn-push-test');
  const msg = document.getElementById('push-msg');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    await api.push.sendTest();
    msg.className = 'form-msg success';
    msg.textContent = 'Notificação enviada! Verifique o browser.';
    setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 4000);
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message || 'Erro ao enviar notificação de teste.';
    setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 4000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Testar notificação';
  }
});

// Threshold selector change (ALERT-04)
document.getElementById('sel-threshold').addEventListener('change', async (e) => {
  const threshold = parseInt(e.target.value);
  try {
    await api.push.setThreshold(threshold);
    const msg = document.getElementById('push-msg');
    msg.className = 'form-msg success';
    msg.textContent = 'Threshold atualizado!';
    setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 2000);
  } catch (err) {
    console.error('[push] Erro ao atualizar threshold:', err.message);
  }
});

// Fechar banner de alertas in-app (D-04, D-06)
document.getElementById('btn-fechar-banner-alertas').addEventListener('click', async () => {
  const banner = document.getElementById('banner-alertas');

  // 1. Ocultar imediatamente (UX responsivo)
  banner.style.display = 'none';

  // 2. Buscar IDs dos alertas pendentes para marcar como fechados na sessão
  try {
    const { alertas } = await api.alertas.pendentes();
    if (alertas && alertas.length > 0) {
      const ids = alertas.map(a => a.id);
      // Marcar no sessionStorage — banner não reaparece nesta sessão (D-06)
      marcarFechadosNaSessao(ids);
      // Marcar no servidor como visto — banner não reaparece em outros dispositivos
      await api.alertas.marcarVisto(ids).catch(() => {
        // Falha na marcação servidor não impede o comportamento local
        console.warn('[alertas] Não foi possível marcar como visto no servidor');
      });
    }
  } catch (err) {
    console.error('[alertas] Erro ao processar fechamento do banner:', err.message);
  }
});

// ── Admin: importação CSV (Fase 7, HIST-01 / HIST-02 / HIST-03) ─────────────

// Estado da prévia atual — usado pelo botão Confirmar
let _adminPreviewLinhas = [];

/**
 * Renderiza o resumo numérico da prévia no #admin-resumo.
 * @param {{ total_linhas, validas, duplicatas, erros }} data
 */
function renderizarResumoAdmin({ total_linhas, validas, duplicatas, erros }) {
  const el = document.getElementById('admin-resumo');
  el.innerHTML =
    `<span>Total de linhas: <strong>${total_linhas}</strong></span>` +
    `<span class="resumo-ok">✓ Novas: ${validas}</span>` +
    `<span class="resumo-dup">⚠ Duplicatas: ${duplicatas}</span>` +
    `<span class="resumo-erro">✗ Erros: ${erros}</span>`;
}

/**
 * Renderiza a tabela de linhas válidas (novas) no #admin-table-novas.
 * @param {Array} linhas
 */
function renderizarTabelaNovas(linhas) {
  const tbody = document.querySelector('#admin-table-novas tbody');
  if (!linhas.length) { tbody.innerHTML = ''; return; }
  tbody.innerHTML = linhas.map(r => `
    <tr>
      <td>${r.linha}</td>
      <td>${String(r.bairro).replace(/</g, '&lt;')}</td>
      <td>${r.nivel}</td>
      <td>${r.data.slice(0, 10)}</td>
      <td>${r.latitude}</td>
      <td>${r.longitude}</td>
      <td>${r.descricao ? String(r.descricao).replace(/</g, '&lt;') : '—'}</td>
    </tr>
  `).join('');
}

/**
 * Renderiza erros de validação no #admin-tbody-erros.
 * @param {Array} erros
 */
function renderizarTabelaErros(erros) {
  const tbody = document.getElementById('admin-tbody-erros');
  tbody.innerHTML = erros.map(r =>
    `<tr><td>${r.linha}</td><td>${r.erros.join('; ')}</td></tr>`
  ).join('');
}

/**
 * Renderiza duplicatas no #admin-tbody-dup.
 * @param {Array} dups
 */
function renderizarTabelaDups(dups) {
  const tbody = document.getElementById('admin-tbody-dup');
  tbody.innerHTML = dups.map(r =>
    `<tr><td>${r.linha}</td><td>${String(r.bairro).replace(/</g, '&lt;')}</td>` +
    `<td>${r.nivel}</td><td>${r.data.slice(0, 10)}</td><td>#${r.id_existente}</td></tr>`
  ).join('');
}

// Botão: Visualizar Prévia
document.getElementById('btn-admin-preview').addEventListener('click', async () => {
  const btn  = document.getElementById('btn-admin-preview');
  const msg  = document.getElementById('admin-msg');
  const file = document.getElementById('admin-csv-input').files[0];

  // Reset UI
  document.getElementById('admin-preview-section').style.display = 'none';
  document.getElementById('admin-resultado').style.display = 'none';
  _adminPreviewLinhas = [];
  msg.className = 'form-msg';
  msg.textContent = '';

  if (!file) {
    msg.className = 'form-msg error';
    msg.textContent = 'Selecione um arquivo CSV.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Processando...';

  try {
    const csvText = await file.text();
    const data = await api.admin.preview(csvText);

    renderizarResumoAdmin(data);
    document.getElementById('admin-preview-section').style.display = 'block';

    // Linhas novas
    const secNovas = document.getElementById('admin-preview-novas');
    if (data.preview.length > 0) {
      renderizarTabelaNovas(data.preview);
      secNovas.style.display = 'block';
      _adminPreviewLinhas = data.preview;
    } else {
      secNovas.style.display = 'none';
    }

    // Erros de validação
    const secErros = document.getElementById('admin-preview-erros');
    if (data.erros_detalhe.length > 0) {
      renderizarTabelaErros(data.erros_detalhe);
      secErros.style.display = 'block';
    } else {
      secErros.style.display = 'none';
    }

    // Duplicatas
    const secDup = document.getElementById('admin-preview-dup');
    if (data.duplicatas_detalhe.length > 0) {
      renderizarTabelaDups(data.duplicatas_detalhe);
      secDup.style.display = 'block';
    } else {
      secDup.style.display = 'none';
    }

    if (data.preview.length === 0) {
      msg.className = 'form-msg';
      msg.textContent = data.erros > 0
        ? 'Nenhuma linha válida para importar. Corrija os erros e tente novamente.'
        : 'Todas as linhas já existem no banco (duplicatas).';
    }
  } catch (err) {
    console.error('[admin] Erro na prévia:', err.message);
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Visualizar Prévia';
  }
});

// Botão: Confirmar Importação
document.getElementById('btn-admin-confirmar').addEventListener('click', async () => {
  const btn = document.getElementById('btn-admin-confirmar');
  const msg = document.getElementById('admin-msg');

  if (!_adminPreviewLinhas.length) return;

  btn.disabled = true;
  btn.textContent = 'Importando...';
  msg.className = 'form-msg';
  msg.textContent = '';

  try {
    const resultado = await api.admin.confirmar(_adminPreviewLinhas);

    // Esconder prévia; exibir resultado
    document.getElementById('admin-preview-section').style.display = 'none';
    _adminPreviewLinhas = [];

    const el = document.getElementById('admin-resultado');
    const errosTxt = resultado.erros.length
      ? `<div class="res-erro" style="margin-top:.5rem">✗ Erros ao inserir: ${resultado.erros.length}</div>`
      : '';
    el.innerHTML =
      `<div class="res-ok">✓ ${resultado.inseridos} ocorrência(s) importada(s) com sucesso!</div>` +
      `<div class="res-dup">⚠ ${resultado.duplicatas_ignoradas} duplicata(s) ignorada(s)</div>` +
      errosTxt;
    el.style.display = 'block';

    // Limpar o file input para nova importação
    document.getElementById('admin-csv-input').value = '';
  } catch (err) {
    console.error('[admin] Erro ao confirmar importação:', err.message);
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Importação';
  }
});

// Seletor de antecedência de alerta
document.getElementById('sel-alert-hours').addEventListener('change', async (e) => {
  const hours_before = parseInt(e.target.value);
  try {
    await api.push.setAlertHours(hours_before);
    const msg = document.getElementById('push-msg');
    msg.className = 'form-msg success';
    msg.textContent = 'Antecedência atualizada!';
    setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 2000);
  } catch (err) {
    console.error('[push] Erro ao atualizar antecedência:', err.message);
  }
});

// ── Init ─────────────────────────────────────────────────
carregarStats();
carregarCamadaRisco();
carregarHeatmap();
carregarSessao().then(() => verificarAlertasPendentes()); // D-05: verificar alertas ao carregar

// Verificar staleness da previsão meteorológica ao carregar
api.previsao.atual().then(data => {
  if (data?.stale) {
    document.getElementById('banner-stale-forecast').style.display = 'block';
  }
}).catch(() => { /* silencioso — não bloquear init */ });

// ── Ferramentas de Teste (Admin) ─────────────────────────────────────────────
document.getElementById('btn-test-stale').addEventListener('click', async () => {
  const msg = document.getElementById('test-forecast-msg');
  msg.textContent = 'Simulando…';
  try {
    const r = await fetch('/api/admin/test/stale-forecast', { method: 'POST' });
    const d = await r.json();
    msg.textContent = d.msg || 'Feito.';
    // Atualiza o banner imediatamente
    const data = await api.previsao.atual().catch(() => null);
    document.getElementById('banner-stale-forecast').style.display = data?.stale ? 'block' : 'none';
  } catch { msg.textContent = 'Erro ao simular.'; }
});

document.getElementById('btn-test-reset').addEventListener('click', async () => {
  const msg = document.getElementById('test-forecast-msg');
  msg.textContent = 'Resetando…';
  try {
    const r = await fetch('/api/admin/test/reset-forecast', { method: 'POST' });
    const d = await r.json();
    msg.textContent = d.msg || 'Feito.';
    document.getElementById('banner-stale-forecast').style.display = 'none';
  } catch { msg.textContent = 'Erro ao resetar.'; }
});

// Registrar service worker para push notifications (D-11)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      swRegistration = reg;
      console.log('[sw] Registrado com sucesso');
    })
    .catch(err => console.error('[sw] Falha no registro:', err));
}

// Auto-refresh a cada 60s
// Inclui camada de risco apenas quando modo é 'risco' (D-04 — não re-renderizar em modo ocorrências)
setInterval(() => {
  carregarStats();
  if (state.modoAtivo === 'risco') {
    carregarCamadaRisco();
  } else {
    carregarMapa();
  }
  verificarAlertasPendentes();  // D-18: polling de alertas in-app
}, 60_000);
