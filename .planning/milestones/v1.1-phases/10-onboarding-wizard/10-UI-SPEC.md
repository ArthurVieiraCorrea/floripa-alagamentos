---
phase: 10
slug: onboarding-wizard
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-24
---

# Phase 10 — UI Design Contract: Onboarding Wizard

> Contrato visual e de interação para o wizard modal de 3 passos.
> Gerado por gsd-ui-researcher. Verificado por gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — vanilla CSS + HTML5 |
| Icon library | none — Unicode characters usados existentes (&#9679; etc.) |
| Font | system-ui, sans-serif (fonte existente do projeto) |

**Decisão de sistema:** Não há shadcn, Tailwind ou biblioteca de componentes. O wizard herda e estende
as CSS custom properties já declaradas em `frontend/src/styles/main.css`. Nenhum token novo de paleta
é introduzido.

---

## Spacing Scale

Escala existente no projeto (múltiplos de 4 e 8):

| Token | Value | Usage no wizard |
|-------|-------|-----------------|
| xs | 4px | Gap entre ícone de status e texto de feedback |
| sm | 8px | Espaço vertical entre elementos internos do step |
| md | 16px | Padding interno do modal body; gap entre botões |
| lg | 24px | Padding do modal (topo/laterais/base) |
| xl | 32px | Margem entre indicador de progresso e conteúdo |
| 2xl | 48px | Altura mínima da área de conteúdo de cada step |

Exceções: nenhuma. O modal não usa touch targets de 44px porque é desktop-first (mobile é responsivo via breakpoint ≤640px com ajuste de largura).

---

## Dimensões do Modal

| Propriedade | Valor | Justificativa |
|-------------|-------|---------------|
| max-width | 480px | Suficiente para o texto de cada passo sem parecer genérico; alinha com a largura da sidebar (340px) mais margem confortável |
| width (mobile) | calc(100vw - 32px) | Mantém 16px de margem em cada lado em telas ≤640px |
| padding interno | 24px | Token `lg` — consistente com section padding do app |
| border-radius | 12px | Maior que os 6px dos cards para destacar o modal como camada superior sem quebrar o idioma visual |
| max-height | 90vh | Evita overflow em telas pequenas |

---

## Backdrop

| Propriedade | Valor | Justificativa |
|-------------|-------|---------------|
| background | rgba(0, 0, 0, 0.65) | Escurece o fundo claramente mas não borra o contexto da aplicação |
| z-index | 1000 | Mesmo z-index do `#auth-container`; o modal estará em z-index 1001 |
| position | fixed, inset 0 | Cobre toda a viewport incluindo o mapa |

**Comportamento ao clicar fora do modal:** bloqueado (não fecha, não pula).

Justificativa: O wizard é o único caminho para configurar calendar e push no primeiro acesso. Clicar
fora acidentalmente e fechar o wizard definitivamente (D-06: pular é permanente) seria uma perda
irreversível sem confirmação visual. Clicar fora ativa um sutil shake animation no modal (200ms,
translateX ±6px, 2 ciclos) sinalizando que a ação esperada é usar os botões. O usuário ainda pode
pular via o botão "Pular" explícito.

---

## Indicador de Progresso

**Escolha:** Texto "Passo X de 3" + linha de dots coloridos.

Justificativa: Três passos é um número pequeno o suficiente para dots visuais. O texto "Passo X de 3"
ao lado dos dots elimina ambiguidade para usuários que não decodificam dots imediatamente. Progress
bar foi descartada por sugerir completude parcial de um passo único; "1 / 3" puro foi descartado por
falta de contexto visual.

Especificação dos dots:
- Tamanho: 8px × 8px, border-radius 50%
- Dot ativo: `var(--accent)` (#3b82f6)
- Dot visitado (passo já completado): `var(--accent)` com opacity 0.4
- Dot futuro: `var(--border)` (#334155)
- Gap entre dots: 8px
- Posição: acima do título do passo, alinhado à esquerda junto com o texto "Passo X de 3"

Layout do indicador:
```
[dot][dot][dot]  Passo 1 de 3
```
Texto: font-size 0.75rem, color `var(--text-muted)`, font-weight 400.

---

## Estrutura do Modal (HTML Semântico)

```
div#wizard-backdrop                        (position: fixed, inset 0, z-index: 1000)
  div#wizard-modal   role="dialog"         (position: relative, z-index: 1001)
    aria-labelledby="wizard-title"
    aria-modal="true"
    ├── div.wizard-header
    │     ├── div.wizard-progress          (dots + texto "Passo X de 3")
    │     └── h2#wizard-title              (título do passo atual)
    ├── div.wizard-body                    (conteúdo do passo)
    │     └── p.wizard-desc               (texto explicativo)
    │     └── div.wizard-action-area      (botão de ação do passo, se houver)
    │     └── div.wizard-feedback         (mensagem inline de sucesso/erro)
    └── div.wizard-footer
          ├── button#wizard-btn-pular     (esquerda, estilo ghost)
          └── button#wizard-btn-proximo   (direita, estilo btn-primary)
```

---

## Typography

Herda todos os tamanhos do projeto. O wizard usa apenas os seguintes:

| Role | Size | Weight | Line Height | Elemento |
|------|------|--------|-------------|---------|
| Título do step | 1rem (16px) | 600 | 1.3 | `h2#wizard-title` |
| Body / descrição | 0.875rem (14px) | 400 | 1.5 | `p.wizard-desc` |
| Label / metadata | 0.75rem (12px) | 400 | 1.4 | Progress indicator, dicas, `.wizard-feedback` (reutiliza `.form-msg`) |

Fonte: `system-ui, sans-serif` — sem importação nova.

---

## Color

Todos os valores são CSS custom properties já declaradas em `main.css`. Nenhuma cor nova.

| Role | Valor CSS | Valor hex | Uso no wizard |
|------|-----------|-----------|---------------|
| Dominant (60%) | `var(--bg)` | #0f172a | Backdrop (com opacity) |
| Secondary (30%) | `var(--surface)` | #1e293b | Fundo do modal (`background`) |
| Surface interna | `var(--surface2)` | #263549 | Área de feedback, separadores internos |
| Borda | `var(--border)` | #334155 | Borda do modal, separador header/footer |
| Texto principal | `var(--text)` | #e2e8f0 | Título do step, texto do botão Próximo |
| Texto secundário | `var(--text-muted)` | #94a3b8 | Descrições, progress label |
| Accent (10%) | `var(--accent)` | #3b82f6 | Dot ativo, botão Próximo/Concluir, link Pular hover |
| Sucesso | #14532d / #86efac | — | `.form-msg.success` — reutilizado do app |
| Erro | #7f1d1d / #fca5a5 | — | `.form-msg.error` — reutilizado do app |

Accent reservado para: dot do passo ativo, botão primário "Próximo / Concluir", e estado hover do botão "Pular".

---

## Estilos de Botão no Modal

### Botão "Próximo / Concluir" (primário)
Reutiliza `.btn-primary` do `main.css` com ajuste de `width: auto` (não full-width no footer do modal):
- background: `var(--accent)`
- color: #fff
- border-radius: 6px
- padding: 12px 24px
- font-size: 0.875rem
- font-weight: 600
- min-width: 120px
- Estado desabilitado (durante loading): opacity 0.5, cursor: not-allowed

### Botão "Pular" (ghost)
- background: transparent
- border: none
- color: `var(--text-muted)`
- font-size: 0.875rem
- font-weight: 400
- cursor: pointer
- padding: 12px 0
- Hover: color `var(--accent)`
- Transição: color 0.15s (padrão do app)

### Footer layout
- display: flex, justify-content: space-between, align-items: center
- border-top: 1px solid `var(--border)`
- padding-top: 16px
- margin-top: 24px

---

## Estilos CSS do Modal (novos — a adicionar em main.css)

```css
/* ── Phase 10: Onboarding Wizard ─────────────────────── */
#wizard-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

#wizard-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  max-width: 480px;
  width: calc(100vw - 32px);
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  z-index: 1001;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

/* Shake animation ao clicar fora */
@keyframes wizard-shake {
  0%, 100% { transform: translateX(0); }
  25%       { transform: translateX(-6px); }
  75%       { transform: translateX(6px); }
}
#wizard-modal.shaking {
  animation: wizard-shake 0.2s ease-in-out 2;
}

.wizard-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s, opacity 0.2s;
}
.wizard-dot.ativo    { background: var(--accent); }
.wizard-dot.visitado { background: var(--accent); opacity: 0.4; }

.wizard-progress-label {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-left: 4px;
}

#wizard-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
  line-height: 1.3;
}

.wizard-desc {
  font-size: 0.875rem;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 16px;
}

.wizard-action-area {
  margin-bottom: 8px;
}

.wizard-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 24px;
}

#wizard-btn-pular {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 12px 0;
  transition: color 0.15s;
}
#wizard-btn-pular:hover { color: var(--accent); }

#wizard-btn-proximo {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 12px 24px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  min-width: 120px;
  transition: opacity 0.15s;
}
#wizard-btn-proximo:hover    { opacity: 0.85; }
#wizard-btn-proximo:disabled { opacity: 0.5; cursor: not-allowed; }

/* Responsive */
@media (max-width: 640px) {
  #wizard-modal { padding: 16px; }
  .wizard-footer { gap: 8px; }
}
```

---

## Copywriting Contract

### Passo 1 — Boas-vindas

| Elemento | Cópia |
|----------|-------|
| Título | "Bem-vindo ao Floripa Alagamentos" |
| Descrição | "Este app monitora o risco de alagamento em tempo real nos bairros de Florianópolis e avisa você antes de ir a um lugar que pode estar alagado. Nos próximos 2 passos você conecta seu calendário e ativa os alertas." |
| Botão primário | "Próximo" |
| Botão pular | "Pular configuração" |
| Área de ação | nenhuma (passo informativo) |
| Feedback | nenhum |

### Passo 2 — Conectar Google Calendar

| Elemento | Cópia |
|----------|-------|
| Título | "Conecte seu Google Calendar" |
| Descrição | "O app verifica seus eventos das próximas 72h e calcula o risco de alagamento nos bairros onde eles acontecem. Seu calendário nunca é modificado." |
| Botão de ação (principal do step) | "Conectar Calendário" |
| Botão primário (avançar) | "Próximo" — habilitado imediatamente; conectar não é obrigatório para avançar |
| Botão pular | "Pular configuração" |
| Feedback sucesso | "Calendário conectado com sucesso." |
| Feedback erro (genérico) | "Não foi possível conectar. Você pode tentar novamente na aba Calendário." |
| Feedback erro (sem permissão) | "Permissão de calendário não foi concedida no login. Saia e entre novamente para autorizar." |
| Estado do botão durante loading | "Conectando..." (disabled) |

### Passo 3 — Ativar Notificações Push

| Elemento | Cópia |
|----------|-------|
| Título | "Ative as notificações push" |
| Descrição | "Receba alertas no seu dispositivo quando um evento do seu calendário cair em um bairro com risco elevado — mesmo com o app fechado." |
| Botão de ação (principal do step) | "Ativar notificações" |
| Botão primário (concluir) | "Concluir" |
| Botão pular | "Pular configuração" |
| Feedback sucesso | "Notificações ativadas." |
| Feedback erro (permissão negada) | "Permissão de notificações bloqueada no browser. Acesse as configurações do navegador para liberar e tente novamente." |
| Feedback erro (genérico) | "Não foi possível ativar. Você pode tentar novamente na aba Calendário." |
| Estado do botão durante loading | "Ativando..." (disabled) |

### Confirmação ao Pular

Não há diálogo de confirmação. O botão "Pular configuração" é rotulado com clareza suficiente.
Ao clicar, o modal fecha imediatamente e o flag `onboarding_done = 1` é gravado.

Não há ações destrutivas de dados neste fluxo — pular configura preferências, não deleta nada.

### Estados de Erro do Modal (falha no PATCH do flag)

Se `PATCH /api/usuarios/me` falhar ao gravar `onboarding_done = 1`, o modal fecha mesmo assim
(silenciosa degradação). O wizard pode reaparecer no próximo login — aceitável, pois é preferível
a travar o usuário na tela de onboarding.

---

## Acessibilidade

| Contrato | Implementação |
|----------|---------------|
| Foco armadilhado no modal | Tab/Shift+Tab circulam apenas entre "Pular" e "Próximo/Concluir" e o botão de ação do step |
| Foco inicial | Ao abrir, foco vai para `#wizard-modal` (`tabindex="-1"`) |
| Fechar com Escape | Não fecha (mesmo comportamento que clicar fora — exige uso dos botões) |
| role="dialog" | Declarado no `#wizard-modal` |
| aria-modal="true" | Declarado no `#wizard-modal` |
| aria-labelledby | Aponta para `#wizard-title` |
| Anúncio de feedback | `.wizard-feedback` com `role="status"` para sucesso; `role="alert"` para erro |

---

## Interaction States por Passo

### Passo 2 — sequência de estados do botão "Conectar Calendário"

```
[Conectar Calendário]  →  click  →  [Conectando... (disabled)]
                                      ↓ sucesso
                                     [feedback.success visível] + botão some
                                      ↓ erro
                                     [feedback.error visível] + botão volta ao estado normal
```

O botão "Próximo" permanece habilitado em todos os estados — conectar não é bloqueante.

### Passo 3 — sequência de estados do botão "Ativar notificações"

```
[Ativar notificações]  →  click  →  [Ativando... (disabled)]
                                      ↓ sucesso
                                     [feedback.success visível] + botão some
                                      ↓ erro
                                     [feedback.error visível] + botão volta ao estado normal
```

O botão "Concluir" permanece habilitado em todos os estados.

---

## Registry Safety

| Registry | Blocos usados | Safety Gate |
|----------|---------------|-------------|
| shadcn official | nenhum — projeto usa vanilla CSS | not applicable |
| Terceiros | nenhum | not applicable |

Projeto usa vanilla CSS. Nenhum registry de componentes envolvido.

---

## Componente Inventory

Elementos novos a criar nesta fase:

| ID | Tipo | Arquivo | Reutiliza do app |
|----|------|---------|-----------------|
| `#wizard-backdrop` | div | `index.html` (injetado por JS) | não |
| `#wizard-modal` | div[role=dialog] | `index.html` (injetado por JS) | não |
| `.wizard-progress` | div | interna do modal | não |
| `.wizard-dot` | div×3 | interna do modal | não |
| `#wizard-title` | h2 | interna do modal | não |
| `.wizard-desc` | p | interna do modal | não |
| `.wizard-action-area` | div | interna do modal | não |
| `.wizard-feedback` | div | interna do modal | reutiliza `.form-msg` styles |
| `.wizard-footer` | div | interna do modal | não |
| `#wizard-btn-pular` | button | interna do modal | padrão ghost (novo) |
| `#wizard-btn-proximo` | button | interna do modal | derivado de `.btn-primary` |
| `abrirWizard()` | função JS | `main.js` | não |
| `fecharWizard()` | função JS | `main.js` | não |
| `wizard-shake` | keyframes CSS | `main.css` | não |

Elementos reutilizados do app sem modificação:

| ID/Classe | Origem | Como reutilizado |
|-----------|--------|-----------------|
| `api.conectarCalendario()` | `api.js` | Chamado no passo 2 |
| `btn-push-optin` flow | `main.js` (~814) | Lógica reutilizada no passo 3 |
| `.form-msg.success` / `.form-msg.error` | `main.css` | Aplicado ao `.wizard-feedback` |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: FLAG (não-bloqueante — "Próximo" palavra única; todos estados declarados)
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-27
