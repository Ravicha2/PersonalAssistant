(function () {
  const DEFAULT_BACKEND = 'http://localhost:3000';

  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send-btn');
  const includeContextEl = document.getElementById('include-context');
  const statusEl = document.getElementById('status');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const backendUrlEl = document.getElementById('backend-url');
  const apiKeyEl = document.getElementById('api-key');
  const llmProviderEl = document.getElementById('llm-provider');
  const llmApiKeyEl = document.getElementById('llm-api-key');
  const llmModelEl = document.getElementById('llm-model');
  const saveSettingsBtn = document.getElementById('save-settings');
  const closeSettingsBtn = document.getElementById('close-settings');

  const DEFAULT_MODELS = { claude: 'claude-sonnet-4-20250514', openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile' };

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }

  function appendMessage(role, content, isStreaming = false) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;
    const roleLabel = document.createElement('div');
    roleLabel.className = 'role';
    roleLabel.textContent = role === 'user' ? 'You' : 'Assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = content;
    if (isStreaming) wrap.dataset.streaming = '1';
    wrap.appendChild(roleLabel);
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendToolMessage(toolName, content) {
    const wrap = document.createElement('div');
    wrap.className = 'message tool';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = `Tool: ${toolName}\n${content}`;
    wrap.appendChild(bubble);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function getStoredSettings() {
    const out = await chrome.storage.local.get(['backendUrl', 'apiKey', 'llmProvider', 'llmApiKey', 'llmModel']);
    const provider = out.llmProvider || 'claude';
    return {
      backendUrl: out.backendUrl || DEFAULT_BACKEND,
      apiKey: out.apiKey || '',
      llmProvider: provider,
      llmApiKey: out.llmApiKey || '',
      llmModel: out.llmModel || DEFAULT_MODELS[provider],
    };
  }

  function getWsUrl(backendUrl, token) {
    const base = backendUrl.replace(/^http/, 'ws');
    const sep = base.includes('?') ? '&' : '?';
    return token ? `${base}/ws${sep}token=${encodeURIComponent(token)}` : `${base}/ws`;
  }

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  settingsBtn.addEventListener('click', async () => {
    const s = await getStoredSettings();
    backendUrlEl.value = s.backendUrl;
    apiKeyEl.value = s.apiKey;
    llmProviderEl.value = s.llmProvider;
    llmApiKeyEl.value = s.llmApiKey;
    llmModelEl.value = s.llmModel;
    settingsPanel.classList.remove('hidden');
  });
  closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.add('hidden'));
  saveSettingsBtn.addEventListener('click', async () => {
    const provider = llmProviderEl.value;
    await chrome.storage.local.set({
      backendUrl: backendUrlEl.value.trim() || DEFAULT_BACKEND,
      apiKey: apiKeyEl.value.trim(),
      llmProvider: provider,
      llmApiKey: llmApiKeyEl.value.trim(),
      llmModel: llmModelEl.value.trim() || DEFAULT_MODELS[provider],
    });
    setStatus('Settings saved.');
    settingsPanel.classList.add('hidden');
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    const { backendUrl, apiKey, llmProvider, llmApiKey, llmModel } = await getStoredSettings();
    if (!backendUrl) {
      setStatus('Set Backend URL in settings.', true);
      return;
    }
    if (!apiKey) {
      setStatus('Set Backend API Key in settings.', true);
      return;
    }
    if (!llmApiKey) {
      setStatus('Set LLM API Key in settings (your Claude/OpenAI/Groq key).', true);
      return;
    }

    inputEl.value = '';
    sendBtn.disabled = true;
    appendMessage('user', text);

    let context = { tabs: [], closed_tabs: [] };
    if (includeContextEl.checked) {
      setStatus('Collecting tab context...');
      try {
        context = await chrome.runtime.sendMessage({ action: 'collectContext' });
        setStatus(`Context: ${context.tabs?.length ?? 0} tabs`);
      } catch (e) {
        setStatus('Context collection failed; sending without.', true);
      }
    } else {
      setStatus('');
    }

    const wsUrl = getWsUrl(backendUrl, apiKey);
    const ws = new WebSocket(wsUrl);
    let currentBubble = null;

    ws.onopen = () => {
      setStatus('Connected.');
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'auth_ok') {
          setStatus('Sending...');
          ws.send(JSON.stringify({
            type: 'chat',
            id: crypto.randomUUID(),
            message: text,
            context,
            allow_tools: true,
            provider: llmProvider,
            api_key: llmApiKey,
            model: llmModel,
          }));
          currentBubble = appendMessage('assistant', '', true);
          return;
        }
        if (msg.type === 'error') {
          setStatus(msg.message || 'Error', true);
          if (currentBubble) currentBubble.textContent += '\n[Error: ' + msg.message + ']';
          return;
        }
        if (msg.type === 'text_delta' && currentBubble) {
          currentBubble.textContent += msg.delta;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        if (msg.type === 'tool_use') {
          if (currentBubble) currentBubble.textContent += `\n[Tool: ${msg.name}]`;
        }
        if (msg.type === 'tool_result') {
          appendToolMessage(msg.tool_use_id, msg.content);
          if (currentBubble) currentBubble.textContent += '\n[Tool result received]';
        }
        if (msg.type === 'done') {
          if (currentBubble) currentBubble.dataset.streaming = '';
          setStatus(msg.usage ? `Done. Tokens: ${msg.usage.input_tokens + msg.usage.output_tokens}` : 'Done.');
        }
      } catch (e) {
        setStatus('Invalid message from server', true);
      }
    };

    ws.onerror = () => setStatus('WebSocket error.', true);
    ws.onclose = () => {
      sendBtn.disabled = false;
      if (statusEl.textContent === 'Sending...') setStatus('Connection closed.');
    };
  }

  getStoredSettings().then(({ backendUrl, llmProvider }) => {
    if (backendUrl) setStatus(`Backend: ${backendUrl} · ${llmProvider}`);
  });
})();
