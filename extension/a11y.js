/**
 * Accessibility: focus management, live regions, modal trap.
 * Runs after popup.js so the DOM is ready and React has rendered.
 */
(function () {
  const streamingStatusEl = document.getElementById('streaming-status');
  const messagesEl = document.getElementById('messages');
  const statusEl = document.getElementById('status');
  const inputEl = document.getElementById('input');
  const mainFlow = document.getElementById('main-flow');
  const authView = document.getElementById('auth-view');
  const pageChat = document.getElementById('page-chat');
  const pageSettings = document.getElementById('page-settings');
  const pageConnectors = document.getElementById('page-connectors');
  const connectModal = document.getElementById('connect-modal');
  const connectCancel = document.getElementById('connect-cancel');
  const connectSubmit = document.getElementById('connect-submit');
  const connectApiKeyInput = document.getElementById('connect-api-key');

  if (!streamingStatusEl || !messagesEl) return;

  /** Announce streaming state for screen readers */
  let streamingCheckTimer = null;
  let lastMessageText = '';
  const STREAMING_DEBOUNCE_MS = 600;

  function updateStreamingStatus() {
    if (!streamingStatusEl) return;
    const lastAssistant = messagesEl.querySelector('.message.assistant:last-of-type .bubble');
    const currentText = lastAssistant ? (lastAssistant.textContent || '').trim() : '';
    if (currentText !== lastMessageText) {
      lastMessageText = currentText;
      if (streamingCheckTimer) clearTimeout(streamingCheckTimer);
      streamingCheckTimer = setTimeout(function () {
        streamingCheckTimer = null;
        const stillStreaming = messagesEl.querySelector('.message.assistant[data-streaming="1"]');
        if (stillStreaming) {
          streamingStatusEl.textContent = 'Assistant is typing.';
        } else if (currentText) {
          streamingStatusEl.textContent = 'Message complete.';
        } else {
          streamingStatusEl.textContent = '';
        }
      }, STREAMING_DEBOUNCE_MS);
    }
  }

  const observer = new MutationObserver(function () {
    updateStreamingStatus();
  });
  observer.observe(messagesEl, { childList: true, subtree: true, characterData: true });

  /** Focus first logical element when view changes */
  function focusPageStart() {
    if (authView && !authView.classList.contains('hidden')) {
      const first = document.getElementById('auth-backend-url') || document.querySelector('#auth-view input');
      if (first) first.focus();
      return;
    }
    if (mainFlow && mainFlow.classList.contains('hidden')) return;
    if (pageSettings && !pageSettings.classList.contains('hidden')) {
      const back = document.getElementById('back-from-settings');
      if (back) back.focus();
      return;
    }
    if (pageConnectors && !pageConnectors.classList.contains('hidden')) {
      const back = document.getElementById('back-from-connectors');
      if (back) back.focus();
      return;
    }
    if (pageChat && !pageChat.classList.contains('hidden') && inputEl) {
      inputEl.focus();
    }
  }

  /** Focus when popup loads */
  function onLoad() {
    setTimeout(focusPageStart, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onLoad);
  } else {
    onLoad();
  }

  /** Observe visibility changes to move focus when user switches Chat / Settings / Connectors */
  const pageObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'class') {
        focusPageStart();
      }
    });
  });
  [pageChat, pageSettings, pageConnectors].forEach(function (el) {
    if (el) pageObserver.observe(el, { attributes: true });
  });

  /** Modal: trap focus and restore on close */
  if (connectModal && connectCancel && connectSubmit && connectApiKeyInput) {
    const focusableInModal = function () {
      const sel = 'button, [href], input, select, textarea [tabindex]:not([tabindex="-1"])';
      return [].slice.call(connectModal.querySelectorAll(sel)).filter(function (el) {
        return el.offsetParent !== null && !el.disabled;
      });
    };

    connectModal.addEventListener('keydown', function (e) {
      if (connectModal.classList.contains('hidden')) return;
      if (e.key !== 'Tab') return;
      const focusable = focusableInModal();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    function restoreFocusAfterClose() {
      const trigger = document.querySelector('[data-open-connect-modal]');
      if (trigger && trigger.focus) trigger.focus();
      else if (inputEl) inputEl.focus();
    }

    connectCancel.addEventListener('click', restoreFocusAfterClose);
    connectSubmit.addEventListener('click', function () {
      setTimeout(restoreFocusAfterClose, 150);
    });
  }

  /** Optional: mark status as alert for errors so screen reader interrupts */
  if (statusEl) {
    const statusObserver = new MutationObserver(function () {
      const text = (statusEl.textContent || '').trim().toLowerCase();
      const isError = text.indexOf('error') !== -1 || text.indexOf('failed') !== -1;
      statusEl.setAttribute('role', isError ? 'alert' : 'status');
      statusEl.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    });
    statusObserver.observe(statusEl, { childList: true, characterData: true, subtree: true });
  }
})();
