# Personal Assistant — Chrome Extension + Backend + MCP

Chrome extension that provides a Claude-style chat interface, collects browser context from open (and optionally closed) tabs, and streams responses from a **backend** (Node or Python) that connects to **Anthropic’s Claude API** and **Model Context Protocol (MCP)** servers.

## Architecture overview

- **Frontend:** Chrome extension (chat popup, context collection trigger, real-time streaming).
- **Backend:** Node (Fastify) or Python (FastAPI) — LLM & MCP connector, WebSocket/REST API. Use **Node** (`backend/`) if the extension gets WebSocket 403 with Python.
- **Context:** HTML from open tabs → markdown → packaged with user message → sent to Claude.

See **[docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md](docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md)** for the full technical specification.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md](docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md) | Architecture, data flow, auth, context extraction, security, tech stack, MCP, permissions, rate limiting. |
| [docs/API_CONTRACTS_AND_PATTERNS.md](docs/API_CONTRACTS_AND_PATTERNS.md) | WebSocket/REST contracts, message shapes, backend and extension code patterns. |
| [docs/PERMISSIONS_REFERENCE.md](docs/PERMISSIONS_REFERENCE.md) | Extension permissions summary and alternatives. |
| [docs/CONNECTORS.md](docs/CONNECTORS.md) | Why there are no “connectors” like Claude.ai, and how to add real ones (MCP). |
| [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md) | Demo flow: ask about page, summarize, calendar, Google Docs; official MCP. |
| [docs/README.md](docs/README.md) | Doc index and suggested implementation order. |

## Project structure (target)

```
PersonalAssistant/
├── docs/           # Specifications and references (above)
├── extension/      # Chrome extension (manifest, popup, service worker)
├── backend/        # Node (Fastify) backend — use this if Python WebSocket has 403
├── backend_py/     # Python FastAPI backend (LLM & MCP connector)
└── README.md       # This file
```

## Implementation order

1. Backend skeleton (auth, WebSocket, health).
2. Claude client (streaming messages).
3. Extension popup + WebSocket client + mock context.
4. Context collection (tabs, inject, markdown, size limits).
5. End-to-end: real context → backend → Claude → stream to UI.
6. MCP: connect servers, list/call tools, feed results back to Claude.
7. Hardening: errors, rate limits, token usage, consent, security.

## Quick start

1. **Backend** (choose one)
   - **Node (recommended if extension WebSocket gets 403):** `cd backend`, copy `.env.example` to `.env`, set `JWT_SECRET` and optionally `BACKEND_API_KEY`, then `npm install && npm run dev`. Server at `http://localhost:3000`; data in `backend/data/`.
   - **Python:** `cd backend_py`, venv + `pip install -r requirements.txt`, copy `.env.example` to `.env`, then `python main.py`. Server at `http://localhost:3000`; data in `backend_py/data/`.

2. **Extension**
   - In Chrome go to `chrome://extensions`, enable "Developer mode", click "Load unpacked", select the `extension` folder.
   - **Sign in:** Open the popup → enter Backend URL, email, password → "Create account" or "Sign in". (Or use **Settings** to set a Backend API key and skip sign-in.)
   - In **Settings** set **LLM** provider and API key. Use **Connectors** to connect Notion and **Google** (Calendar & Docs). For **multi-user** (app online), use **Connectors → Google** so each person connects their own account; set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in backend `.env`. You can also add MCP servers (e.g. Google Workspace MCP, Time, Brave Search).
   - Type a message and Send; responses stream from your chosen LLM.

## Prerequisites

- **Backend:** Node 18+ (for the Node backend). Anthropic (or OpenAI/Groq) API key can be in backend `.env` or from the extension. Optional: MCP servers.
- **Extension:** Backend URL and backend API token in extension settings.
- **Chrome:** Load unpacked extension from `extension/` folder.

## Voice input and read‑aloud

- **Voice input (mic):** Click the microphone next to the message box. When Chrome asks for microphone access, choose **Allow**. If nothing happens, check the status line under the chat; if it says "Microphone denied", open the extensions page (`chrome://extensions`), find Personal Assistant → **Details** → ensure **Microphone** is allowed (or remove and re-add the extension to get the prompt again).
- **Read aloud:** Click the speaker icon to hear the last assistant reply. Send a message and get a response first; then click the speaker to read it aloud.

## Docling (built-in document parsing)

The **Node backend** can run [Docling](https://github.com/docling-project/docling) so the assistant gets a **parse_document** tool (PDF, DOCX, PPTX, HTML → markdown).

1. **Install Docling** where the backend runs (Python 3.10+).  
   **Avoid permission errors (e.g. on Windows):** use a virtual environment or `--user`:
   ```bash
   # Option A: Virtual environment (recommended)
   cd backend
   python -m venv .venv
   .venv\Scripts\activate          # Windows
   # source .venv/bin/activate     # macOS/Linux
   pip install docling
   ```
   ```bash
   # Option B: Install for your user only (no admin)
   pip install --user docling
   ```
   If you use Option A, set in `backend/.env`: `DOCLING_PYTHON_PATH=./.venv/Scripts/python.exe` (Windows) or `DOCLING_PYTHON_PATH=./.venv/bin/python` (macOS/Linux), or the full path to that executable.
2. **Enable in backend** — in `backend/.env`:
   ```env
   DOCLING_ENABLED=1
   # If not using default python/python3 (e.g. venv or --user install):
   # Windows venv: DOCLING_PYTHON_PATH=./.venv/Scripts/python.exe
   # macOS/Linux venv: DOCLING_PYTHON_PATH=./.venv/bin/python
   ```
3. Restart the backend. The model will see **parse_document** and can use it when the user shares a document URL (e.g. “Summarize this PDF: https://…”).

On **Render** (and most Node-only hosts), Docling is usually **not** available unless you add a separate Python runtime; leave `DOCLING_ENABLED` unset there. For local or self-hosted setups with Python installed, Docling works as above.

---

## Deploy the backend on Render

Only the **backend** is deployed; the Chrome extension stays on users’ machines and points to your backend URL.

### 1. Create a Web Service

1. Go to [render.com](https://render.com) and sign in.
2. **New → Web Service**.
3. Connect your repo (GitHub/GitLab) and select this repository.

### 2. Configure the service

| Field | Value |
|-------|--------|
| **Name** | `personal-assistant-backend` (or any name) |
| **Region** | Choose closest to your users |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or paid for always-on WebSockets) |

### 3. Environment variables

In **Environment** (or **Environment Variables**), add at least:

| Key | Value | Required |
|-----|--------|----------|
| `JWT_SECRET` | Random secret (e.g. `openssl rand -hex 32`) | Yes |
| `BACKEND_API_KEY` | A secret token for the extension (optional if using sign-in) | Recommended |
| `PORT` | `3000` (Render sets this automatically; only override if needed) | No |
| `ALLOWED_ORIGINS` | `*` (or list origins; extensions often need `*` for CORS) | Yes for CORS |
| `ANTHROPIC_API_KEY` | Default Claude API key (or let users set their own in the extension) | Optional |
| `GOOGLE_CLIENT_ID` | If using Connectors → Google (OAuth) | Optional |
| `GOOGLE_CLIENT_SECRET` | If using Connectors → Google | Optional |
| `GOOGLE_REDIRECT_URI` | `https://your-service-name.onrender.com/auth/google/callback` | If using Google |

Do **not** set `DOCLING_ENABLED` on Render unless you add a custom Docker image with Python + Docling.

### 4. Deploy and use the extension

1. Click **Create Web Service** (or **Save** and let it deploy).
2. After deploy, copy the service URL (e.g. `https://personal-assistant-backend.onrender.com`).
3. In the **extension**: open the popup → set **Backend URL** to that URL (e.g. `https://personal-assistant-backend.onrender.com`) → sign in or set **Backend API Key** in Settings.
4. Use the extension as usual; chat and tools go to your Render backend.

### 5. Notes for Render

- **WebSockets:** Supported on Render. The extension connects to `wss://your-service.onrender.com/ws`. On the **free** tier the service may spin down after inactivity; the first request after idle can be slow.
- **HTTPS:** Render provides HTTPS; use `https://` (not `http://`) as the Backend URL in the extension.
- **Google OAuth:** If you use Connectors → Google, set **Redirect URI** in Google Cloud Console to `https://your-service-name.onrender.com/auth/google/callback` (replace with your real Render URL).

---

**Note:** You can run either **Node** (`backend/`) or **Python** (`backend_py/`). If the extension gets WebSocket 403 with Python, use the Node backend. **Render deployment** uses the Node backend (`backend/`).

*Start with [docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md](docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md) for implementation.*
