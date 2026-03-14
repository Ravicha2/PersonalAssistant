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

- **Backend:** Python 3.10+. Anthropic (or OpenAI/Groq) API key can be in backend `.env` or from the extension. Optional: MCP servers.
- **Extension:** Backend URL and backend API token in extension settings.
- **Chrome:** Load unpacked extension from `extension/` folder.

---

**Note:** You can run either **Node** (`backend/`) or **Python** (`backend_py/`). If the extension gets WebSocket 403 with Python, use the Node backend.

*Start with [docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md](docs/ARCHITECTURE_AND_IMPLEMENTATION_PLAN.md) for implementation.*
