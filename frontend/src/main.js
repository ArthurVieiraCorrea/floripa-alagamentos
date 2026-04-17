import { api } from './services/api.js';
import { iniciarMapa, renderizarMarcadores, renderizarCamadaRisco, removerCamadaRisco } from './services/mapa.js';
import { criarControleToggle, criarControleSeletor } from './services/controles.js';

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
  modoAtivo: 'risco',             // 'risco' | 'ocorrencias' — D-03 default: risco
  horizonteAtivo: 24,             // 24 | 48 | 72 — D-05 default: 24h
  geojsonBairros: null,           // cache do fetch de bairros.geojson — fetch uma única vez
  usuario: null,                  // usuário autenticado atual (com alert_threshold)
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
// Expor função de atualização de timestamp para carregarCamadaRisco() usar (D-08)
atualizarTimestamp = seletor.atualizarTimestamp;

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
      await carregarCalendario(usuario);
    } else {
      state.usuario = null;
      btnLogin.style.display  = 'inline-block';
      userInfo.style.display  = 'none';
      document.getElementById('tab-btn-admin').style.display = 'none';
      carregarCalendario(null);
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err.message);
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
  const btnOn  = document.getElementById('btn-push-optin');
  const btnOff = document.getElementById('btn-push-optout');
  const thRow  = document.getElementById('push-threshold-row');
  const hoursRow = document.getElementById('push-hours-row');

  btnOn.style.display    = 'none';
  btnOff.style.display   = 'none';
  thRow.style.display    = 'none';
  hoursRow.style.display = 'none';

  if (status === 'ativo') {
    icon.style.color  = '#22c55e';
    texto.textContent = 'Notificações push ativas';
    btnOff.style.display   = 'inline-block';
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

    // Exibir botão de recálculo imediato
    document.getElementById('admin-recalcular-section').style.display = 'block';
  } catch (err) {
    console.error('[admin] Erro ao confirmar importação:', err.message);
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirmar Importação';
  }
});

// Botão: Recalcular Risco Agora
document.getElementById('btn-admin-recalcular').addEventListener('click', async () => {
  const btn = document.getElementById('btn-admin-recalcular');
  const msg = document.getElementById('admin-recalcular-msg');
  btn.disabled = true;
  btn.textContent = 'Recalculando...';
  msg.className = 'form-msg';
  msg.textContent = '';
  try {
    await api.admin.recalcular();
    msg.className = 'form-msg success';
    msg.textContent = '✓ Risco recalculado! O mapa será atualizado no próximo refresh.';
  } catch (err) {
    console.error('[admin] Erro ao recalcular:', err.message);
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Recalcular Risco Agora';
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
// D-03: modo padrão é 'risco' — NÃO chamar carregarMapa() no startup para evitar estado misto (D-04)
// carregarMapa() só é chamado quando o usuário clica [Ocorrências] no toggle
carregarCamadaRisco(); // carrega choropleth no startup (modo padrão: risco)
carregarSessao().then(() => verificarAlertasPendentes()); // D-05: verificar alertas ao carregar

// Verificar staleness da previsão meteorológica ao carregar
api.previsao.atual().then(data => {
  if (data?.stale) {
    document.getElementById('banner-stale-forecast').style.display = 'block';
  }
}).catch(() => { /* silencioso — não bloquear init */ });

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
