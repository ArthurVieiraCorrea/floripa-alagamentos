# Floripa Alagamentos

Sistema de monitoramento e previsão de alagamentos em Florianópolis — mapa interativo de risco com dados meteorológicos em tempo real, alertas push e integração com Google Calendar.

## Pré-requisitos

- [Node.js](https://nodejs.org/) versão 18 ou superior
- Conta no [Google Cloud Console](https://console.cloud.google.com) (para OAuth)
- Conta gratuita na [Visual Crossing](https://www.visualcrossing.com) (para dados meteorológicos)

## Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/ArthurVieiraCorrea/floripa-alagamentos.git
cd floripa-alagamentos
```

### 2. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas credenciais (veja a seção [Configurando as APIs](#configurando-as-apis) abaixo).

### 3. Instale as dependências do backend

```bash
cd backend
npm install
```

### 4. Instale as dependências do frontend

```bash
cd ../frontend
npm install
```

## Rodando o projeto

Abra dois terminais:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
O servidor sobe em `http://localhost:3001`

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
O frontend sobe em `http://localhost:5173`

Acesse `http://localhost:5173` no navegador.

---

## Configurando as APIs

### Google OAuth (para integração com Google Calendar)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto
3. Vá em **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**
4. Tipo: **Aplicativo da Web**
5. Em "URIs de redirecionamento autorizados", adicione: `http://localhost:3001/auth/google/callback`
6. Copie o **Client ID** e o **Client Secret** para o `.env`
7. Em **APIs e Serviços → Biblioteca**, ative a **Google Calendar API**

### Visual Crossing (meteorologia)

1. Crie uma conta gratuita em [visualcrossing.com](https://www.visualcrossing.com)
2. Vá em **Account → API Key**
3. Copie a chave para `VISUAL_CROSSING_API_KEY` no `.env`

### Chaves de segurança

Gere `SESSION_SECRET` e `ENCRYPTION_KEY` com o comando:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Execute duas vezes e use os resultados para cada variável. A `ENCRYPTION_KEY` deve ter exatamente 64 caracteres hexadecimais.

---

## Estrutura do projeto

```
floripa-alagamentos/
├── backend/          # API Node.js/Express + SQLite
│   └── src/
│       ├── routes/   # Endpoints REST
│       ├── services/ # Integração com APIs externas
│       └── app.js    # Entrada do servidor
├── frontend/         # Interface Vite + Leaflet
│   └── src/
│       └── services/ # Mapa, controles, alertas
└── .env.example      # Template de configuração
```
