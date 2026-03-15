# Screen Reader & Accessibility Feasibility

**Scope:** Chrome extension popup (Personal Assistant).  
**Goal:** Assess feasibility of full screen reader support and outline changes.

---

## Verdict: **Feasible — medium effort**

Screen reader support is **fully feasible** with standard web accessibility techniques. The popup is regular HTML/CSS/JS in a small window; Chrome and major screen readers (NVDA, JAWS, VoiceOver) work with extension popups. No special APIs are required. The work is mainly **semantic markup, ARIA, focus management, and live regions** for dynamic chat content.

---

## Current state

### Already in good shape

| Area | Current implementation |
|------|-------------------------|
| **Semantic HTML** | Form controls use `<label>`, `<input>`, `<button>`, `<select>`; headings `h1`–`h4`; structure is logical. |
| **ARIA on controls** | Header toolbar has `role="toolbar"` and `aria-label="Header actions"`; icon buttons have `aria-label` (e.g. "Settings", "Send message", "Back to chat"). |
| **Decorative content** | Logo and decorative SVGs use `aria-hidden="true"` so they’re skipped by screen readers. |
| **Input** | Message textarea has `aria-label="Message"`; placeholder is secondary. |
| **Focus styles** | CSS includes `:focus` (and `:focus-within` on composer) for visible focus. |

### Gaps for screen reader users

| Gap | Impact | Fix |
|-----|--------|-----|
| **Chat messages** | Messages are injected into `#messages` with no landmark or live region; new/streaming text is not announced. | Add a live region and semantic structure for the conversation. |
| **No landmark for main content** | Screen reader users can’t jump to “main” or “chat” by landmark. | Add `role="main"` and/or `aria-label` to the chat area. |
| **Dynamic status** | `#status` updates (e.g. “Saving…”, errors) with no announcement. | Use `aria-live` (polite or assertive) and optionally `role="status"` / `role="alert"`. |
| **Focus on open** | When popup opens, focus may not move into the popup. | Move focus to a logical start (e.g. message input or first control) when popup loads. |
| **Page switching** | When toggling Chat / Settings / Connectors, focus and announced “page” may not update. | On view change, move focus to the new page’s heading or first control and optionally announce the new section. |
| **Modal** | Connect modal has no focus trap or return focus on close. | Trap focus inside modal; restore focus to trigger on cancel/close. |
| **Clear chat** | “Clear chat” button may need a confirmation or clearer label for assistive tech. | Ensure `aria-label` describes action; consider `aria-describedby` for confirmation. |

---

## Recommended changes (by priority)

### 1. Live region for chat messages (high impact)

- Wrap the conversation in a single element that screen readers will announce when it changes:
  - `role="log"` or `aria-live="polite"` + `aria-atomic="false"` so new content is announced without re-reading the whole thread.
- For **streaming** assistant replies, either:
  - **Option A:** Put the in-progress message in a dedicated live region with `aria-live="polite"` and update its `textContent` as tokens arrive; screen readers will re-announce on each update (can be noisy), or
  - **Option B:** Add a separate “status” live region that announces “Assistant is typing…” when streaming starts and “Message complete” when done; keep the final message in the main log. Option B is usually better for streaming to avoid constant interruptions.
- Give the messages container a label: e.g. `aria-label="Conversation"` so it’s clear what the region is.

**Example (static structure):**

```html
<div id="messages" class="messages" role="log" aria-label="Conversation" aria-live="polite" aria-atomic="false"></div>
```

For streaming, add a second region:

```html
<div id="streaming-status" aria-live="polite" aria-atomic="true" class="sr-only"></div>
```

Then from JS: set `streaming-status` to “Assistant is typing…” when streaming starts, and “Message complete” (or clear it) when done.

### 2. Visually hidden / screen-reader-only class (required for live status)

- Add a utility class so status text can be announced without affecting layout:

```css
.sr-only, .visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

- Use this for `#streaming-status`, and for any “Saving…”, “Connected”, error messages in `#status` that you want announced.

### 3. Global status announcements

- Give `#status` a live region so all status updates are announced:

```html
<div id="status" class="status" role="status" aria-live="polite" aria-atomic="true"></div>
```

- Use `role="alert"` and `aria-live="assertive"` only for critical errors (e.g. “Connection failed”) so they interrupt the user.

### 4. Focus management

- **On popup open:** After load, call `document.getElementById('input').focus()` (or the first focusable element in the current view) so the cursor starts inside the extension.
- **On view change (Chat ↔ Settings ↔ Connectors):** When showing a new “page”, move focus to the page heading or first control (e.g. `document.getElementById('back-from-settings').focus()` or the first input on that page).
- **Modal (Connect):** When opening the modal, move focus to the first focusable element inside it (e.g. API key input); trap Tab/Shift+Tab inside the modal; on Cancel/Connect, close the modal and restore focus to the button that opened it.

### 5. Landmarks and labels

- Mark the main chat area as main content:

```html
<main id="page-chat" class="page page-chat" aria-label="Chat">
  ...
</main>
```

- Ensure Settings and Connectors pages also have a clear heading in focus order (you already have `h2`); optionally add `aria-label` to their containers (e.g. `aria-label="Settings"`).

### 6. Modal accessibility

- On the connect modal:
  - Add `role="dialog"` and `aria-modal="true"` to the modal container.
  - `aria-labelledby="connect-modal-title"` (you already have `id="connect-modal-title"`).
  - Focus trap and return focus as above.

### 7. Keyboard

- Confirm full tab order: Tab moves through all interactive elements in a logical order (header → messages area → input row → composer). No custom widgets require arrow-key handling beyond what’s already there; standard controls are enough.
- Ensure no `outline: none` without a visible focus alternative (your current `:focus` styles are fine; keep them).

---

## Implementation effort (rough)

| Task | Effort | Notes |
|------|--------|--------|
| Live region for messages + streaming status | Small | Markup + a few JS updates when stream starts/ends. |
| `.sr-only` and status `role="status"` / `aria-live` | Small | CSS + one or two HTML attributes. |
| Focus on popup open | Small | One focus() call after load. |
| Focus on view change | Small | Focus first element of visible page when switching. |
| Modal focus trap + return focus | Medium | Add keydown listener for Tab/Shift+Tab and focus restoration. |
| Landmarks and extra labels | Small | Add `role="main"`, `aria-label` where needed. |
| Testing with NVDA / VoiceOver | Small–medium | Test once, then regression-check after changes. |

**Total:** On the order of **1–2 days** for a developer familiar with a11y, plus testing. No backend or new dependencies required.

---

## Testing

- **Chrome + NVDA (Windows):** Popup opens in its own window; NVDA will read focus and live regions. Test: open popup → Tab through controls → send a message → confirm streaming and final message are announced as intended.
- **Chrome + VoiceOver (macOS):** Same idea; use VO key to move by landmarks/headings and confirm conversation and status updates.
- **Keyboard only:** Unplug mouse; use Tab, Enter, Space, Escape to do sign-in, send a message, open Settings, open modal, cancel. Ensure no focus trap except inside the modal.

---

## References

- [Chrome Extensions – Support accessibility](https://developer.chrome.com/docs/extensions/how-to/ui/a11y)
- [ARIA live regions (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions)
- [WAI-ARIA roles, states, properties](https://www.w3.org/TR/wai-aria/)

---

## Implementation status (March 2025)

The following have been implemented in the extension:

- **Live regions:** `#messages` has `role="log"`, `aria-label="Conversation"`, `aria-live="polite"`. A separate `#streaming-status` (`.sr-only`) announces “Assistant is typing.” / “Message complete.” via `a11y.js` (MutationObserver on message DOM).
- **Status:** `#status` has `role="status"`, `aria-live="polite"`; `a11y.js` sets `role="alert"` and `aria-live="assertive"` when the message looks like an error.
- **Landmarks:** Chat area is `<main id="page-chat" role="main" aria-label="Chat">`.
- **Modal:** Connect modal has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="connect-modal-title"`. `a11y.js` implements Tab focus trap and restores focus on cancel/submit.
- **Focus:** `a11y.js` focuses the message input (or first control on Settings/Connectors) on load and when switching views (MutationObserver on page visibility).
- **`.sr-only`:** Added in `popup.css` for screen-reader-only content.
- **Clear chat / Read aloud:** Buttons have `aria-label`; “Reply for voice” and “Read last response aloud” added with appropriate labels.

*Summary: Screen reader support is feasible with standard HTML/ARIA and a small amount of JS for focus and live regions. The above changes implement the recommended priorities.*
