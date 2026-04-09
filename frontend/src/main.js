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
  geojsonBairros: null            // cache do fetch de bairros.geojson — fetch uma única vez
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
        <button class="btn-deletar" data-id="${o.id}" title="Deletar ocorrência">✕</button>
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

    if (usuario) {
      btnLogin.style.display  = 'none';
      userInfo.style.display  = 'flex';
      userNome.textContent    = usuario.nome || usuario.email;
      await carregarCalendario(usuario);
    } else {
      btnLogin.style.display  = 'inline-block';
      userInfo.style.display  = 'none';
      carregarCalendario(null);
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err.message);
  }
}

// ── Init ─────────────────────────────────────────────────
carregarStats();
// D-03: modo padrão é 'risco' — NÃO chamar carregarMapa() no startup para evitar estado misto (D-04)
// carregarMapa() só é chamado quando o usuário clica [Ocorrências] no toggle
carregarCamadaRisco(); // carrega choropleth no startup (modo padrão: risco)
carregarSessao();

// Auto-refresh a cada 60s
// Inclui camada de risco apenas quando modo é 'risco' (D-04 — não re-renderizar em modo ocorrências)
setInterval(() => {
  carregarStats();
  if (state.modoAtivo === 'risco') {
    carregarCamadaRisco();
  } else {
    carregarMapa();
  }
}, 60_000);
