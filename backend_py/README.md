# Personal Assistant Backend (FastAPI)

Python FastAPI backend for the Personal Assistant Chrome extension: auth, Connectors (Google OAuth, MCP config), chat over WebSocket and SSE, and LLM + MCP tool orchestration.

## Setup

```bash
cd backend_py
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set at least `JWT_SECRET` and optionally `BACKEND_API_KEY`, `ANTHROPIC_API_KEY`, and Google OAuth vars.

## Run

```bash
# From backend_py directory
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 3000
```

Server runs at `http://localhost:3000`. Use this URL as the Backend URL in the extension.

## Data

File-based store under `data/` (or `DATA_DIR` in `.env`): users, connectors (Google, Notion), MCP server config, and MCP tool manifests. No separate database required.

## API

- **Auth:** `POST /auth/register`, `POST /auth/login`
- **User:** `GET /users/me`
- **Connectors:** `GET/POST/DELETE /users/me/connectors`
- **Google OAuth:** `GET /auth/google?token=...`, `GET /auth/google/callback`
- **MCP:** `GET/PUT /api/mcp-servers/config`, `GET /api/mcp-servers` (registry)
- **Chat:** `POST /v1/chat` (SSE), `WebSocket /ws?token=...`
- **Health:** `GET /health`
