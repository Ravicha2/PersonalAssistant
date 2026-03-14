# External MCP Servers for Students (Research Summary)

This doc lists **external MCP (Model Context Protocol) servers** that are especially useful for a **student-focused personal assistant**: calendar, docs, **NotebookLM**, notes, tasks, search, PDFs, and knowledge tracking. The backend **integrates** them: add MCP servers in Connectors (per-user config in `data/mcp-servers.json`).

---

## Multi-user / when the app is online

If you deploy this app so **many people** use it (e.g. students at a school), each person should get **their own** Google Calendar and Docs. Use **built-in Google** for that:

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend `.env` (OAuth 2.0 Desktop app in Google Cloud; enable Calendar and Docs APIs).
2. Each user opens **Connectors** in the extension and clicks **Connect** on **Google**, then **Sign in with Google**. Their refresh token is stored per user in the backend.
3. The assistant then uses that user’s token for calendar and doc tools — so each person sees only their own data.

The **Google Workspace MCP** (community) stores credentials in a single path per server, so it effectively gives **one Google account per backend**. Use it for single-user or self-hosted; for multi-user online, use built-in Google above.

---

## Config in data/, registry vs PulseMCP

- **Google (Calendar, Docs):** **When the app is online for multiple users**, use **Connectors → Google** (built-in OAuth). Each user signs in with their own Google account; tokens are stored per user so everyone gets their own Calendar and Docs. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the backend `.env`. **Alternatively**, for single-user or self-hosted, add the **Google Workspace** MCP preset in Connectors (community server `@alanxchen/google-workspace-mcp`); that MCP uses one credentials file per server, so it does not scale to many users. **Other tools** are **external MCP**; we prefer **official** servers where available.
- **Config in data/:** MCP server config is stored **per user** in `data/mcp-servers.json` (and optional fallback `MCP_SERVERS_JSON` in env). Tool manifests are persisted in `data/mcp-tool-manifests.json` after a successful connect.
- **Registry vs PulseMCP:** The extension "Search more MCP servers" uses the **official MCP Registry**. **PulseMCP** is a separate directory; we do not call PulseMCP for search. Use the registry in-app; use PulseMCP in the browser to discover servers, then add them via Connectors.
- **Tool context:** The backend injects available tool names into the system prompt and persists tool manifests when connecting so the model knows what to call.

---

## Integration (use everything in this project)

The backend **already supports** external MCP servers. Prefer saving config in the app (Connectors → add MCP); env is optional fallback.

1. **Save MCP config in the app:** In the extension, open **Connectors** → use "Recommended for students" or "Search more MCP servers" → **Connect**. Config is stored in `data/mcp-servers.json` per user. For presets that need an API key (e.g. Brave Search), a modal asks for it.
2. **Optional: `MCP_SERVERS_JSON`** in `backend/.env` (Node) or `backend_py/.env` (Python) as fallback. Each entry:
   - **`id`** (string): short name for this server (e.g. `brave`, `time`).
   - **`command`** (string): executable to run (e.g. `npx`, `node`, `python`).
   - **`args`** (array of strings, optional): arguments (e.g. `["-y", "@modelcontextprotocol/server-brave-search"]`).
   - **`env`** (object, optional): extra env vars (e.g. `{ "BRAVE_API_KEY": "your-key" }`).

3. **Restart the backend** if you changed env. On first chat that uses tools, the backend connects to each server (stdio), fetches `tools/list`, merges them with demo tools (echo, add), and saves each server's tool list to `data/mcp-tool-manifests.json`. The LLM system prompt includes "Available tools: …" so the model knows what's connected.

4. **Example — Brave Search + Time (no keys for Time):**
   ```bash
   # One line, no line breaks inside the JSON
   MCP_SERVERS_JSON=[{"id":"brave","command":"npx","args":["-y","@modelcontextprotocol/server-brave-search"],"env":{"BRAVE_API_KEY":"YOUR_BRAVE_KEY"}},{"id":"time","command":"npx","args":["-y","@modelcontextprotocol/server-time"]}]
   ```
   Get a Brave API key (free tier): [brave.com/search/api](https://brave.com/search/api).

5. **Example — add Todo list MCP (student tasks):**
   - Install/runnable: e.g. `npx -y todo-list-mcp` or clone [RegiByte/todo-list-mcp](https://github.com/regibyte/todo-list-mcp) and run with `node dist/index.js` (path in `args`).
   - Add one more object to the `MCP_SERVERS_JSON` array with `command` and `args` that start that server.

6. **NotebookLM (Google):** Lets the assistant query your NotebookLM notebooks (sources, Q&A). Requires Python: `pip install notebooklm-mcp`, then `notebooklm-mcp init https://notebooklm.google.com/notebook/YOUR_ID` and a config file. Add to the array: `{"id":"notebooklm","command":"notebooklm-mcp","args":["--config","/path/to/notebooklm-config.json","server"]}`. See **NotebookLM** section below.

7. **More servers** (Notion, Obsidian, PDF, Memory, etc.): same idea. Each runs as a separate process; the backend spawns them and aggregates their tools. See sections below for links and required env/keys.

---

## Where to discover MCP servers

- **Official MCP registry** (preview): [registry.modelcontextprotocol.io](https://modelcontextprotocol.io/registry/about) — REST API for discovering published servers.
- **Official reference servers (GitHub)**: [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — Fetch, Filesystem, Git, Memory, Time, Brave Search, etc.
- **PulseMCP directory**: [pulsemcp.com/servers](https://pulsemcp.com/servers) — 8,500+ servers, searchable; good for browsing by category.
- **Other indexes**: [mcpindex.net](https://mcpindex.net), [mcp.so](https://mcp.so), [playbooks.com/mcp](https://playbooks.com/mcp) — alternative directories.

---

## 1. Google Workspace (Calendar, Gmail, Drive, Docs, Sheets)

Useful for: class schedule, deadlines, email, assignments in Drive/Docs.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Google Workspace MCP** | Single server: Gmail, Drive, Calendar, Docs, Sheets, Slides, Forms, Tasks, Contacts, Chat, Apps Script. OAuth, multi-account. | [workspacemcp.com](https://workspacemcp.com), [ghaziahamat/google-workspace-mcp](https://github.com/ghaziahamat/google-workspace-mcp) |
| **Google Docs MCP** | Create, read, update, search, share, export Google Docs. | [lkm1developer/google-docs-mcp-server](https://github.com/lkm1developer/google-docs-mcp-server), [mcp-server-directory.com](https://www.mcp-server-directory.com/servers/google-docs-mcp-server) |
| **Google Drive MCP** | Search/list Drive files, read content. (Official one is archived; community alternatives exist.) | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (archived), [mcpindex.net](https://mcpindex.net/en/mcpserver/modelcontextprotocol-server-google-drive) |

**Note:** These use their own OAuth/credential setup. If you use one, you typically don’t need to implement Calendar/Docs in your backend — the MCP server exposes the tools.

**Is there an official Google MCP for Docs/Calendar?** Google does not ship a standalone MCP for Workspace. For this app: use **Connectors → Google** (built-in) so **each user** has their own account when the app is online; or add the **Google Workspace** MCP preset for single-user/self-hosted (set `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` in `.env`).

---

## 2. NotebookLM (Google)

Useful for: research, course materials, source-grounded Q&A — the assistant can query your NotebookLM notebooks.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **notebooklm-mcp** | List/query NotebookLM notebooks, add sources, generate audio. Uses your NotebookLM notebook(s) as context. | [PyPI notebooklm-mcp](https://pypi.org/project/notebooklm-mcp/), [jacob-bd/notebooklm-mcp](https://github.com/jacob-bd/notebooklm-mcp) |
| **notebooklm-mcp-2026** | FastMCP-based; query notebooks from Claude, Cursor, VS Code. | [julianoczkowski/notebooklm-mcp-2026](https://github.com/julianoczkowski/notebooklm-mcp-2026), [PyPI](https://pypi.org/project/notebooklm-mcp-2026/) |

**Setup:** Install (e.g. `pip install notebooklm-mcp`), run `notebooklm-mcp init https://notebooklm.google.com/notebook/YOUR_NOTEBOOK_ID`, then start the MCP server with the generated config: `notebooklm-mcp --config notebooklm-config.json server`. Use that `command` + `args` (and full path to config) in `MCP_SERVERS_JSON`.

---

## 3. Notes & knowledge (Notion, Obsidian)

Useful for: class notes, study wikis, linking concepts.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Notion MCP** | Pages and databases: create, query, search, markdown. OAuth. | [makenotion/notion-mcp-server](https://github.com/makenotion/notion-mcp-server) |
| **Obsidian MCP** | Read/write notes in an Obsidian vault: search, create/update, TODOs, frontmatter, periodic notes. | [cyanheads/obsidian-mcp-server](https://github.com/cyanheads/obsidian-mcp-server), [krisk248/obsidian-notes-mcp](https://github.com/krisk248/obsidian-notes-mcp), [igorilic/obsidian-mcp](https://github.com/igorilic/obsidian-mcp) |

---

## 4. Tasks, todos & reminders

Useful for: homework, deadlines, daily plans.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Todo List MCP** | Create, list, search, update, complete, delete tasks. Works with Claude Desktop / Cursor. | [RegiByte/todo-list-mcp](https://github.com/regibyte/todo-list-mcp), [mcp.so](https://mcp.so/server/todo-list-mcp/RegiByte) |
| **MCP Tasks** | Tasks in Markdown/JSON/YAML, status (To Do, In Progress, Done), filtering, persistence. | [flesler/mcp-tasks](https://github.com/flesler/mcp-tasks) |
| **MCP Reminder** | Alarms and todos, natural-language times, reminders. | [sheacoding/mcp-reminder](https://github.com/sheacoding/mcp-reminder) |

---

## 5. Search & web (research, assignments)

Useful for: finding sources, checking facts, fetching page content.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Brave Search MCP** | Web, news, image, video search. Official: [brave/brave-search-mcp-server](https://github.com/brave/brave-search-mcp-server). | Needs Brave Search API key (free tier available). |
| **Fetch / URL** | Fetch web page content, extract text/links. Some combine search + fetch (e.g. search then fetch top results). | Official [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) (Fetch); community “search and fetch” variants. |

---

## 6. PDFs & documents (papers, textbooks, handouts)

Useful for: reading papers, summarizing chapters, extracting citations.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **PDF reader MCPs** | Read text, metadata, pages; search; extract images. | [rturv/mcp-pdf-reader](https://github.com/rturv/mcp-pdf-reader), [SylphxAI/pdf-reader-mcp](https://github.com/SylphxAI/pdf-reader-mcp), [pietermyb/mcp-pdf-reader](https://github.com/pietermyb/mcp-pdf-reader) |
| **Academic PDF** | Section detection (Abstract, Methods, etc.), citations, structure. | [averagejoeslab/pdf-reader-mcp](https://github.com/averagejoeslab/pdf-reader-mcp) |

---

## 7. Memory & knowledge (concepts, progress)

Useful for: long-term context, linking courses and concepts.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Memory (official)** | Knowledge-graph style persistent memory. | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |
| **Student Knowledge Graph** | Track academic progress, courses, assignments, concepts and relationships. | [PulseMCP – Student Knowledge Graph](https://www.pulsemcp.com/servers/student-knowledge-graph) (Tejpal Virk) |

---

## 8. Utility (time, files, git)

Useful for: “due tomorrow”, file paths, code/repos.

| Server | What it does | Link / notes |
|--------|----------------|--------------|
| **Time** | Time and timezone conversion. | Official in [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |
| **Filesystem** | Secure file read/write with access controls. | Official in [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |
| **Git** | Repo operations (read, diff, etc.). | Official (or archived) in [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) |

---

## How this fits your Personal Assistant

- **Built-in:** Google (Calendar, Docs) via Connectors in the extension; we request only the scopes we need.
- **External (integrated):** Set `MCP_SERVERS_JSON` and the backend connects to those MCP servers (stdio), merges their tools with built-in, and routes `call_tool` to the right server. So you get **everything**: built-in Google + Brave Search, Time, Todo, Notion, Obsidian, PDF, Memory, etc., in one assistant.
- **Student-focused combo:** In `.env`, add a `MCP_SERVERS_JSON` array that includes (as many as you want):
  - **NotebookLM** (query your notebooks, source-grounded Q&A) — Python, one-time init with notebook URL
  - **Brave Search** (web search for research) — needs `BRAVE_API_KEY`
  - **Time** (official) — no key
  - **Todo list / Reminder** (homework, deadlines)
  - **Notion** or **Obsidian** (notes) — each has its own setup
  - **PDF reader** (papers, handouts)
  - **Student Knowledge Graph** (if you run it)

Links and names were accurate as of research; repos and sites may have moved — use the registry and PulseMCP to find the latest versions and alternatives.
