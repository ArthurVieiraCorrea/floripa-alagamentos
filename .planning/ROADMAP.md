# Roadmap: Floripa Alagamentos

**Milestone:** v1 — Sistema de Alerta de Alagamentos
**Goal:** Avisar usuários autenticados, via notificação push, quando um evento do Google Calendar deles cai em bairro com risco elevado de alagamento previsto nas próximas 72h.
**Success:** Um usuário pode fazer login com Google, conectar seu calendário, ativar notificações push, e receber um alerta antes de sair para uma área com risco Laranja ou Vermelho — sem nenhuma ação manual além da configuração inicial.

---

## Phases

- [ ] **Fase 1: Autenticação** — Google OAuth funcional; sessão persistente; API protegida contra deleções não autorizadas
- [ ] **Fase 2: Integração Meteorológica** — Previsão de precipitação buscada, cacheada e atualizada automaticamente a cada 1h
- [ ] **Fase 3: Motor de Risco** — Score 0-100 por bairro calculado automaticamente, exposto via API
- [ ] **Fase 4: Dashboard de Previsão** — Mapa com camada de risco colorida e seletor 24h/48h/72h visível ao usuário
- [ ] **Fase 5: Integração Google Calendar** — Usuário conecta calendário; sistema resolve eventos para bairros; desconexão graceful
- [ ] **Fase 6: Alertas e Notificações Push** — Sistema detecta eventos em áreas de risco e envia push; fallback in-app para usuários sem subscription
- [ ] **Fase 7: Dados Históricos (Admin)** — Painel de importação CSV valida, deduplica e injeta dados históricos no motor de risco

---

## Phase Details

### Fase 1: Autenticação

**Goal:** Usuário pode fazer login com Google, permanecer autenticado entre sessões, e fazer logout. Deleção de ocorrências passa a exigir autenticação; criação permanece pública.
**Requires:** None
**Delivers:** AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Canonical refs:** `backend/src/app.js`, `backend/src/config/database.js`, `backend/src/routes/ocorrencias.js`, `backend/src/controllers/ocorrenciaController.js`

### Plans

1. **Infraestrutura OAuth** — Configurar `googleapis` OAuth2, criar tabela `usuarios` com criptografia AES-256-GCM para `refresh_token`, adicionar variáveis de ambiente (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ENCRYPTION_KEY)
2. **Rotas de Auth** — Implementar `GET /auth/google`, `GET /auth/google/callback` e `GET /auth/logout`; configurar `express-session` com store SQLite para persistência entre recarregamentos
3. **Proteção de Deleção** — Adicionar middleware `requireAuth` e aplicá-lo somente à rota `DELETE /api/ocorrencias/:id`; adicionar `express-rate-limit` à rota de criação de ocorrências

**UI hint**: yes

---

### Fase 2: Integração Meteorológica

**Goal:** O sistema busca previsão de precipitação via Open-Meteo (fallback INMET), salva em cache SQLite, e atualiza automaticamente a cada 1h via scheduler. Nenhum request do usuário aciona chamadas à API externa.
**Requires:** Fase 1
**Delivers:** PREV-01, PREV-02, PREV-03, PREV-04
**Canonical refs:** `backend/src/config/database.js`, `backend/src/app.js`

### Plans

1. **Schema e Cache de Previsões** — Criar tabela `forecasts` (bairro, lat/lng, forecast_time, precipitacao_mm, fonte, fetched_at); criar tabela `forecasts_meta` para TTL e status da última busca
2. **Serviço de Forecast** — Implementar `backend/src/services/forecastService.js`: busca Open-Meteo por lat/lng de Florianópolis, normaliza resposta (incluindo precipitação acumulada 48h para fator de saturação PREV-04), persiste em `forecasts`, loga erros sem crashar
3. **Scheduler e API de Previsão** — Criar `backend/src/jobs/scheduler.js` com `node-cron` (`0 * * * *`), inicializar em `app.js`; expor `GET /api/previsao/atual` retornando dados cacheados com timestamp de atualização

---

### Fase 3: Motor de Risco

**Goal:** O sistema calcula e persiste score de risco (0-100) para cada bairro a cada 4h. Bairros com histórico insuficiente exibem aviso "dados limitados". Scores são acessíveis via API.
**Requires:** Fase 2
**Delivers:** RISCO-01, RISCO-02, RISCO-03, RISCO-04
**Canonical refs:** `backend/src/models/ocorrencia.js`, `backend/src/config/database.js`, `backend/src/jobs/scheduler.js`

### Plans

1. **Schema de Risk Scores** — Criar tabela `risk_scores` (bairro, window_start, window_end, score, precipitacao_prevista_mm, ocorrencias_historicas_count, insufficient_data flag, calculated_at)
2. **Algoritmo de Scoring** — Implementar `backend/src/services/riskEngine.js`: para cada bairro, cruzar `forecasts` × agregado de `ocorrencias` históricas → calcular score ponderado (peso 0.6 forecast / 0.4 histórico; peso 0.9/0.1 quando histórico < 5 ocorrências); categorizar em Verde/Amarelo/Laranja/Vermelho
3. **Job e API de Risco** — Adicionar job cron `5 */4 * * *` em `scheduler.js` para recalcular todos os bairros; expor `GET /api/risco/bairros` (todos os bairros com score atual) e `GET /api/risco/:bairro` (detalhe com precipitação prevista, histórico e flag insufficient_data)

---

### Fase 4: Dashboard de Previsão

**Goal:** O mapa exibe uma camada choropleth colorida (Verde/Amarelo/Laranja/Vermelho) por bairro. O usuário pode selecionar horizonte 24h, 48h ou 72h. Cada bairro mostra score, mm previstos, contagem histórica e timestamp de atualização.
**Requires:** Fase 3
**Delivers:** DASH-01, DASH-02, DASH-03, DASH-04
**Canonical refs:** `frontend/src/main.js`, `frontend/src/services/mapa.js`, `frontend/src/services/api.js`

### Plans

1. **GeoJSON e Camada Choropleth** — Adicionar arquivo GeoJSON dos bairros de Florianópolis em `frontend/public/bairros.geojson`; implementar `renderizarCamadaRisco(scores, horizonte)` em `mapa.js` usando `L.geoJSON` com `style` baseado no nível de risco
2. **Painel de Risco por Bairro** — Ao clicar em um bairro, exibir popup com: score atual, nível (label + cor), precipitação prevista (mm), número de ocorrências históricas, flag "dados limitados" se aplicável, e timestamp "Atualizado às HH:MM"
3. **Seletor de Horizonte Temporal** — Adicionar controles 24h / 48h / 72h no frontend; ao trocar, re-requisitar `GET /api/risco/bairros?horizonte=48h` e re-renderizar camada choropleth sem recarregar a página

**UI hint**: yes

---

### Fase 5: Integração Google Calendar

**Goal:** Usuário autenticado pode conectar o Google Calendar, ver eventos resolvidos para bairros de Florianópolis nas próximas 72h, associar manualmente eventos sem localização, e desconectar o calendário sem perder a conta.
**Requires:** Fase 1, Fase 3
**Delivers:** CAL-01, CAL-02, CAL-03, CAL-04, CAL-05
**Canonical refs:** `backend/src/routes/`, `backend/src/controllers/`, `backend/src/config/database.js`, `frontend/src/main.js`

### Plans

1. **Schema e Sincronização de Eventos** — Criar tabela `calendar_events_cache` (usuario_id, google_event_id, summary, start_time, end_time, location, bairro_resolvido, synced_at); implementar `backend/src/services/calendarService.js` que busca eventos primários do usuário nas próximas 72h via `googleapis`
2. **Resolução de Localização para Bairro** — Implementar mapeamento fuzzy de texto livre para bairros de Florianópolis (lista curada de nomes + landmarks); salvar `bairro_resolvido` no cache; eventos sem localização ou não resolvidos ficam silenciosos (não bloqueiam)
3. **Rotas de Calendar e UI de Conexão** — Implementar `POST /api/calendar/connect`, `DELETE /api/calendar/disconnect` (limpa refresh_token do calendário sem deletar conta); adicionar job `*/30 * * * *` para sincronizar eventos dos usuários conectados; criar UI para conectar/desconectar calendário e associar bairro manualmente a eventos não resolvidos (CAL-04)

**UI hint**: yes

---

### Fase 6: Alertas e Notificações Push

**Goal:** Usuário com calendário conectado recebe push notification quando um evento cai em bairro com risco acima do threshold configurado. Usuários sem push subscription veem banner in-app. Cada evento é alertado no máximo 1x por ciclo. Sistema detecta `invalid_grant` e avisa o usuário para reconectar.
**Requires:** Fase 5
**Delivers:** ALERT-01, ALERT-02, ALERT-03, ALERT-04, ALERT-05, ALERT-06
**Canonical refs:** `backend/src/jobs/scheduler.js`, `backend/src/services/`, `frontend/public/sw.js`, `frontend/src/main.js`

### Plans

1. **Infraestrutura Web Push** — Instalar `web-push`, gerar VAPID keys, criar tabela `push_subscriptions`; criar `POST /api/push/subscribe` e `DELETE /api/push/unsubscribe`; adicionar `public/sw.js` (service worker que recebe eventos `push` e exibe notificação); implementar fluxo de opt-in com UI explicativa antes de acionar `Notification.requestPermission()` (ALERT-01)
2. **Motor de Alertas** — Implementar `backend/src/services/alertService.js`: cruzar `calendar_events_cache` × `risk_scores` por bairro e janela temporal; filtrar por `alert_threshold` do usuário (ALERT-04, default Laranja=51); checar `alertas_enviados` para deduplicação (ALERT-03); enviar via `webpush.sendNotification`; logar em `alertas_enviados` (ALERT-02); detectar `invalid_grant` e marcar `calendar_disconnected` no usuário (ALERT-06)
3. **Fallback In-App e Preferências** — Implementar `GET /api/alertas/pendentes` para polling (usado pelo 60s interval existente do frontend); exibir banner persistente para usuários sem subscription push (ALERT-05); adicionar UI para configurar threshold de alerta por nível (Verde/Amarelo/Laranja/Vermelho) (ALERT-04)

**UI hint**: yes

---

### Fase 7: Dados Históricos (Admin)

**Goal:** Um administrador autenticado pode fazer upload de CSV com ocorrências históricas, o sistema valida e deduplica antes de inserir, e os dados ficam imediatamente disponíveis para o motor de risco.
**Requires:** Fase 3
**Delivers:** HIST-01, HIST-02, HIST-03
**Canonical refs:** `backend/src/models/ocorrencia.js`, `backend/src/config/database.js`, `backend/src/routes/`

### Plans

1. **Rota de Upload Admin** — Criar `POST /api/admin/import` protegida por `requireAuth`; aceitar `multipart/form-data` com CSV via `multer`; retornar preview de linhas antes de confirmar inserção
2. **Validação e Deduplicação** — Implementar parser CSV que valida campos obrigatórios (lat, lng, bairro, nivel, data), normaliza formatos de data e nível, e detecta duplicatas por `(bairro, nivel, data)` via query no banco antes de inserir
3. **Ingestão e Confirmação** — Inserir registros válidos na tabela `ocorrencias` existente (HIST-03 — disponibilidade imediata é consequência natural); retornar relatório `{ inseridos, duplicatas_ignoradas, erros }` para feedback ao admin

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Autenticação | 2/3 | In progress | - |
| 2. Integração Meteorológica | 0/3 | Not started | - |
| 3. Motor de Risco | 0/3 | Not started | - |
| 4. Dashboard de Previsão | 0/3 | Not started | - |
| 5. Integração Google Calendar | 2/3 | In Progress|  |
| 6. Alertas e Notificações Push | 0/3 | Not started | - |
| 7. Dados Históricos (Admin) | 3/3 | Complete   | 2026-04-15 |

---

## Coverage

| Requirement | Fase | Status |
|-------------|------|--------|
| AUTH-01 | Fase 1 | Implemented (01-02) |
| AUTH-02 | Fase 1 | Implemented (01-02) |
| AUTH-03 | Fase 1 | Implemented (01-02) |
| AUTH-04 | Fase 1 | Pending |
| PREV-01 | Fase 2 | Pending |
| PREV-02 | Fase 2 | Pending |
| PREV-03 | Fase 2 | Pending |
| PREV-04 | Fase 2 | Pending |
| RISCO-01 | Fase 3 | Pending |
| RISCO-02 | Fase 3 | Pending |
| RISCO-03 | Fase 3 | Pending |
| RISCO-04 | Fase 3 | Pending |
| DASH-01 | Fase 4 | Pending |
| DASH-02 | Fase 4 | Pending |
| DASH-03 | Fase 4 | Pending |
| DASH-04 | Fase 4 | Pending |
| CAL-01 | Fase 5 | Pending |
| CAL-02 | Fase 5 | Pending |
| CAL-03 | Fase 5 | Pending |
| CAL-04 | Fase 5 | Pending |
| CAL-05 | Fase 5 | Pending |
| ALERT-01 | Fase 6 | Pending |
| ALERT-02 | Fase 6 | Pending |
| ALERT-03 | Fase 6 | Pending |
| ALERT-04 | Fase 6 | Pending |
| ALERT-05 | Fase 6 | Pending |
| ALERT-06 | Fase 6 | Pending |
| HIST-01 | Fase 7 | Pending |
| HIST-02 | Fase 7 | Pending |
| HIST-03 | Fase 7 | Pending |

**v1 requirements mapped: 31/31**

---

## Backlog

Requirements deferred to v2:

### Notificações Alternativas

- **NOTF-01:** Alertas via email como fallback para browsers sem suporte a push
- **NOTF-02:** Integração WhatsApp Business API para alertas

### Dados e Sensores

- **SENS-01:** Integração com sensores pluviométricos físicos em tempo real (ex: estações INMET em Florianópolis)
- **SENS-02:** Fator de saturação do solo baseado em histórico longo de precipitação acumulada (além dos 48h do v1)
- **SENS-03:** Dados de nível de rios e canais de drenagem

### Social

- **SOCL-01:** Usuários podem validar/confirmar ocorrências reportadas por outros (crowdsourcing com moderação)
- **SOCL-02:** Sistema de reputação para reports de ocorrências

### Analytics

- **ANA-01:** Painel de acurácia dos alertas (quantos alertas resultaram em alagamento real)
- **ANA-02:** Histórico de precisão por bairro para calibração do modelo

---

*Roadmap defined: 2026-04-06*
