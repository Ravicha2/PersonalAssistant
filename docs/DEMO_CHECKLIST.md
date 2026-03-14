# Demo checklist

Use this to verify the full **demo flow**: sign up → connect Google → **ask about the page** → **summarize the page** → **add deadlines to calendar** → **put summary in Google Docs**. All tools use **official MCP servers** where available; Google Calendar and Docs are built-in (single OAuth).

---

## Prerequisites

1. **Backend:** `cd backend_py`, copy `.env.example` to `.env`, set `JWT_SECRET` and (for Google) `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`. Run `python main.py`.
2. **Extension:** Load unpacked from `extension/`, sign in with Backend URL (e.g. `http://localhost:3000`), set **Settings → LLM** (provider, API key, model).
3. **Google:** In the extension, go to **Connectors** → **Connect** Google (OAuth or refresh token). One connection enables both Calendar and Docs.

---

## 1. People can ask about the page

- Open a web page you want to talk about (e.g. an article, a course page).
- In the extension, leave **Include tab context** checked.
- Ask about the page, e.g.:
  - *"What is this page about?"*
  - *"What are the main points on this tab?"*
  - *"What tabs do I have open?"*
- The assistant should answer using the **browser context** (titles, URLs, and content from your open tabs).

---

## 2. AI can summarize the page

- With the same page open and **Include tab context** checked, ask:
  - *"Summarize this page."*
  - *"Give me a short summary of the content on this tab."*
- The assistant should produce a summary **from the page content** in the context, without inventing details.

---

## 3. People can write deadlines / events into the calendar

- With **Google** connected in Connectors, send messages like:
  - *"Add to my calendar: project deadline next Friday at 5pm."*
  - *"Create a calendar event tomorrow at 2pm called Team standup, 30 minutes."*
  - *"Remind me Monday 9am – submit assignment."*
- The assistant should use **create_calendar_event** and confirm the event. Check [Google Calendar](https://calendar.google.com) to see the new event.
- You can also ask *"What’s on my calendar?"* to trigger **list_calendar_events**.

---

## 4. People can put the summary into Google Docs

- With **Google** connected and **Include tab context** checked, ask:
  - *"Summarize this page and put it in a new Google Doc called Research Summary."*
  - *"Create a Google Doc named Lecture Notes with a summary of this page."*
- The assistant should (1) summarize the page from the browser context, (2) call **create_google_doc** with that summary as the content, and (3) confirm with the doc link.

---

## 5. Tools: official MCP + built-in Google

- **Official MCP servers** (add in **Connectors → Recommended for students** or **Search more MCP servers**):
  - **Time** — `@modelcontextprotocol/server-time` (time/timezone; no key).
  - **Brave Search** — `@modelcontextprotocol/server-brave-search` (web search; needs Brave API key).
  - **Fetch** — `@modelcontextprotocol/server-fetch` (fetch URLs to markdown).
  - **Memory** — `@modelcontextprotocol/server-memory` (persistent memory).
  - **Filesystem** — `@modelcontextprotocol/server-filesystem` (local files).
- **Google Calendar & Docs** — Built into the backend (single OAuth in Connectors). No separate MCP server; the backend calls Google APIs directly after you connect Google.

---

## Quick sign-up and login check

- **Sign up:** Open popup → Backend URL, Email, Password → **Create account** → chat view and email in header.
- **Login:** After logout → Backend URL, email, password → **Sign in** → same.

---

## Backend setup (reminder)

1. Copy `backend_py/.env.example` to `backend_py/.env`.
2. Set `JWT_SECRET`; optionally `BACKEND_API_KEY`. LLM API key is set in the **extension** (Settings).
3. For Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback`.
4. Run: `cd backend_py && pip install -r requirements.txt && python main.py`.
5. Load the extension and use the popup for sign-up, Connectors, and chat.
