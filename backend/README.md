# Personal Assistant Backend

LLM & MCP connector for the Personal Assistant Chrome extension. Supports **multiple LLM providers**: users set their own API key and model in the extension (Claude, OpenAI, or Groq). The backend proxies requests to the chosen provider.

## Setup

1. Copy `.env.example` to `.env` and set:
   - `BACKEND_API_KEY` — A secret token the extension will send (e.g. `openssl rand -hex 24`).
   - Optionally `ANTHROPIC_API_KEY` — Used only as fallback when the extension doesn’t send an LLM key (e.g. Claude default).

2. Install and run:

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm start
```

Server listens on `http://0.0.0.0:3000` (or `PORT` from env). WebSocket endpoint: `ws://localhost:3000/ws?token=YOUR_BACKEND_API_KEY`.

## Endpoints

- `GET /health` — Returns `{ "status": "ok" }`.
- `GET /ws` — WebSocket. Auth via query `?token=...` or first message `{ "type": "auth", "token": "..." }`. Then send `{ "type": "chat", "id", "message", "context?", "allow_tools?" }` and receive streaming `text_delta`, `tool_use`, `tool_result`, `done`, `error`.

## Extension configuration

In the extension popup, open Settings and set:

- **Backend:** URL (e.g. `http://localhost:3000`) and **Backend API Key** (same as `BACKEND_API_KEY`).
- **LLM:** **Provider** (Claude / OpenAI / Groq), **LLM API Key** (your key from Anthropic, OpenAI, or Groq), and **Model** (e.g. `gpt-4o-mini`, `claude-sonnet-4-20250514`, `llama-3.3-70b-versatile`).
