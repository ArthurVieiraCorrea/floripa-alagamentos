import { api } from './services/api.js';
import { iniciarMapa, renderizarMarcadores } from './services/mapa.js';

// ── Estado ──────────────────────────────────────────────
const state = {
  marcadores: [],
  tempMarker: null,
  paginaAtual: 1,
  filtros: { nivel: '', bairro: '' }
};

// ── Mapa ────────────────────────────────────────────────
const map = iniciarMapa();

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
      </div>
      ${o.descricao ? `<div class="card-desc">${o.descricao}</div>` : ''}
      <div class="card-data">${formatarData(o.criado_em)}</div>
    </div>
  `).join('');

  // Click -> voa para o ponto no mapa
  lista.querySelectorAll('.card-ocorrencia').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      map.flyTo([lat, lng], 16, { duration: 1 });
      // Abre o popup do marcador correspondente
      state.marcadores.forEach(m => {
        const ll = m.getLatLng();
        if (Math.abs(ll.lat - lat) < 0.0001 && Math.abs(ll.lng - lng) < 0.0001) {
          m.openPopup();
        }
      });
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

  const data = {
    latitude:   parseFloat(form.latitude.value),
    longitude:  parseFloat(form.longitude.value),
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
    } else {
      btnLogin.style.display  = 'inline-block';
      userInfo.style.display  = 'none';
    }
  } catch (err) {
    console.error('Erro ao verificar sessão:', err.message);
  }
}

// ── Init ─────────────────────────────────────────────────
carregarStats();
carregarMapa();
carregarSessao();

// Auto-refresh a cada 60s
setInterval(() => { carregarStats(); carregarMapa(); }, 60_000);
