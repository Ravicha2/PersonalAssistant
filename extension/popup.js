(function () {
  const DEFAULT_BACKEND = 'http://localhost:3000';

  const authView = document.getElementById('auth-view');
  const mainFlow = document.getElementById('main-flow');
  const headerChat = document.getElementById('header-chat');
  const headerSettings = document.getElementById('header-settings');
  const headerConnectors = document.getElementById('header-connectors');
  const pageChat = document.getElementById('page-chat');
  const pageSettings = document.getElementById('page-settings');
  const pageConnectors = document.getElementById('page-connectors');
  const backFromSettings = document.getElementById('back-from-settings');
  const backFromConnectors = document.getElementById('back-from-connectors');
  const authOpenSettings = document.getElementById('auth-open-settings');
  const chatView = document.getElementById('chat-view');
  const userLabel = document.getElementById('user-label');
  const connectorsBtn = document.getElementById('connectors-btn');
  const connectorsCol = document.querySelector('.composer-col-connectors');

  function syncConnectorsColumn() {
    if (!connectorsCol) return;
    connectorsCol.classList.toggle('composer-col-connectors--empty', connectorsBtn.classList.contains('hidden'));
  }
  const logoutBtn = document.getElementById('logout-btn');
  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send-btn');
  const includeContextEl = document.getElementById('include-context');
  const statusEl = document.getElementById('status');
  const settingsBtn = document.getElementById('settings-btn');
  const backendUrlEl = document.getElementById('backend-url');
  const apiKeyEl = document.getElementById('api-key');
  const llmProviderEl = document.getElementById('llm-provider');
  const llmApiKeyEl = document.getElementById('llm-api-key');
  const llmModelEl = document.getElementById('llm-model');
  const saveSettingsBtn = document.getElementById('save-settings');
  const connectorsList = document.getElementById('connectors-list');
  const mcpPresetsList = document.getElementById('mcp-presets-list');
  const mcpSearchInput = document.getElementById('mcp-search-input');
  const mcpSearchBtn = document.getElementById('mcp-search-btn');
  const mcpResults = document.getElementById('mcp-results');
  const authBackendUrl = document.getElementById('auth-backend-url');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authLoginBtn = document.getElementById('auth-login');
  const authRegisterBtn = document.getElementById('auth-register');
  const connectModal = document.getElementById('connect-modal');
  const connectModalTitle = document.getElementById('connect-modal-title');
  const connectLabelText = document.getElementById('connect-label-text');
  const connectHint = document.getElementById('connect-hint');
  const connectApiKey = document.getElementById('connect-api-key');
  const connectSubmit = document.getElementById('connect-submit');
  const connectCancel = document.getElementById('connect-cancel');
  const clearChatBtn = document.getElementById('clear-chat-btn');

  const DEFAULT_MODELS = { claude: 'claude-sonnet-4-20250514', openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile' };
  const CHAT_HISTORY_KEY = 'chatHistory';
  const MAX_CHAT_ITEMS = 200;
  let settingsOpenedFromAuth = false;

  const STUDENT_MCP_PRESETS = [
    { id: 'google-workspace', name: 'Google Workspace', description: 'Community MCP · Calendar, Docs, Gmail, Drive. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in backend .env.', config: { id: 'google-workspace', command: 'npx', args: ['-y', '@alanxchen/google-workspace-mcp@1.0.2'], env: {} } },
    { id: 'time', name: 'Time', description: 'Official MCP · Time and timezone conversion for deadlines and scheduling', config: { id: 'time', command: 'npx', args: ['-y', '@modelcontextprotocol/server-time'], env: {} } },
    { id: 'brave-search', name: 'Brave Search', description: 'Official MCP · Web search (requires Brave API key)', config: { id: 'brave-search', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], env: {} }, needsEnv: true, envKey: 'BRAVE_API_KEY', envLabel: 'Brave API key' },
    { id: 'filesystem', name: 'Filesystem', description: 'Official MCP · Read and write local files for notes and drafts', config: { id: 'filesystem', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'], env: {} } },
    { id: 'memory', name: 'Memory', description: 'Official MCP · Persistent memory for facts and preferences', config: { id: 'memory', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: {} } },
    { id: 'fetch', name: 'Fetch', description: 'Official MCP · Fetch web pages and convert to markdown for research', config: { id: 'fetch', command: 'npx', args: ['-y', '@modelcontextprotocol/server-fetch'], env: {} } },
  ];
  let pendingPresetConfig = null;

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  /** Renders assistant text so markdown links [text](url) become clickable; (#) and invalid URLs become plain text. */
  function renderAssistantContent(text) {
    if (text == null || text === '') return '';
    const escaped = escapeHtml(text);
    const placeholderLinkRegex = /\[([^\]]*)\]\((?!https?:\/\/)[^)]*\)/g;
    const noPlaceholders = escaped.replace(placeholderLinkRegex, (_, label) => label || '');
    const linkRegex = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
    const withLinks = noPlaceholders.replace(linkRegex, (_, label, url) => '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + (label ? escapeHtml(label) : url) + '</a>');
    const bareUrlRegex = /(https?:\/\/[^\s<]+)/g;
    return withLinks.replace(bareUrlRegex, (url) => '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>');
  }

  async function getMcpConfig() {
    const s = await getStoredSettings();
    if (!s.jwt || !s.backendUrl) return [];
    const res = await fetch(s.backendUrl + '/api/mcp-servers/config', { headers: { Authorization: 'Bearer ' + s.jwt } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.servers) ? data.servers : [];
  }
  async function addMcpServer(serverConfig) {
    const s = await getStoredSettings();
    if (!s.jwt || !s.backendUrl) throw new Error('Sign in to add MCP servers.');
    const list = await getMcpConfig();
    const id = serverConfig.id;
    if (list.some((x) => x.id === id)) return;
    list.push({ id: serverConfig.id, command: serverConfig.command, args: serverConfig.args || [], env: serverConfig.env || {} });
    const r = await fetch(s.backendUrl + '/api/mcp-servers/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.jwt },
      body: JSON.stringify({ servers: list }),
    });
    if (!r.ok) {
      const d = await r.json();
      throw new Error(d.message || 'Failed to add');
    }
  }
  async function removeMcpServer(serverId) {
    const s = await getStoredSettings();
    if (!s.jwt || !s.backendUrl) return;
    const list = (await getMcpConfig()).filter((x) => x.id !== serverId);
    await fetch(s.backendUrl + '/api/mcp-servers/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.jwt },
      body: JSON.stringify({ servers: list }),
    });
  }
  function defaultConfigFromServer(server) {
    const name = server.server?.name ?? 'unknown';
    const id = name.replace(/[/.:]/g, '-').replace(/^\-+|\-+$/g, '').slice(0, 32);
    const pkg = server.server?.packages?.[0];
    if (pkg?.identifier && (pkg.runtimeHint === 'npx' || pkg.registryType === 'npm')) {
      return { id, command: 'npx', args: ['-y', pkg.identifier], env: {} };
    }
    return { id, command: 'npx', args: ['-y', name], env: {} };
  }

  function showChatPage() {
    headerChat.classList.remove('hidden');
    headerSettings.classList.add('hidden');
    headerConnectors.classList.add('hidden');
    pageChat.classList.remove('hidden');
    pageSettings.classList.add('hidden');
    pageConnectors.classList.add('hidden');
    settingsOpenedFromAuth = false;
  }

  async function showSettingsPage(fromAuth) {
    settingsOpenedFromAuth = !!fromAuth;
    const s = await getStoredSettings();
    backendUrlEl.value = s.backendUrl;
    apiKeyEl.value = s.apiKey;
    llmProviderEl.value = s.llmProvider;
    llmApiKeyEl.value = s.llmApiKey;
    llmModelEl.value = s.llmModel;
    headerChat.classList.add('hidden');
    headerConnectors.classList.add('hidden');
    headerSettings.classList.remove('hidden');
    pageChat.classList.add('hidden');
    pageConnectors.classList.add('hidden');
    pageSettings.classList.remove('hidden');
    mainFlow.classList.remove('hidden');
    authView.classList.add('hidden');
  }

  function showConnectorsPage() {
    headerChat.classList.add('hidden');
    headerSettings.classList.add('hidden');
    headerConnectors.classList.remove('hidden');
    pageChat.classList.add('hidden');
    pageSettings.classList.add('hidden');
    pageConnectors.classList.remove('hidden');
    loadConnectors();
  }

  async function getStoredChatHistory() {
    const out = await chrome.storage.local.get(CHAT_HISTORY_KEY);
    const raw = out[CHAT_HISTORY_KEY];
    return Array.isArray(raw) ? raw : [];
  }

  async function setStoredChatHistory(history) {
    const trimmed = history.length > MAX_CHAT_ITEMS ? history.slice(-MAX_CHAT_ITEMS) : history;
    await chrome.storage.local.set({ [CHAT_HISTORY_KEY]: trimmed });
  }

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle('error', isError);
  }

  function appendMessage(role, content, isStreaming = false) {
    const wrap = document.createElement('div');
    wrap.className = `message ${role}`;
    const inner = document.createElement('div');
    inner.className = 'message-inner';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = role === 'user' ? 'U' : 'A';
    const body = document.createElement('div');
    body.className = 'message-body';
    const roleLabel = document.createElement('div');
    roleLabel.className = 'role';
    roleLabel.textContent = role === 'user' ? 'You' : 'Assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (role === 'assistant') {
      bubble.innerHTML = renderAssistantContent(content);
    } else {
      bubble.textContent = content;
    }
    if (isStreaming) wrap.dataset.streaming = '1';
    body.appendChild(roleLabel);
    body.appendChild(bubble);
    inner.appendChild(avatar);
    inner.appendChild(body);
    wrap.appendChild(inner);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendToolMessage(toolName, content) {
    const wrap = document.createElement('div');
    wrap.className = 'message tool';
    const inner = document.createElement('div');
    inner.className = 'message-inner';
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = '⚡';
    const body = document.createElement('div');
    body.className = 'message-body';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = `Tool: ${toolName}\n${content}`;
    body.appendChild(bubble);
    inner.appendChild(avatar);
    inner.appendChild(body);
    wrap.appendChild(inner);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function renderHistoryItem(item) {
    if (item.role === 'user') {
      appendMessage('user', item.content);
    } else if (item.role === 'assistant') {
      appendMessage('assistant', item.content || '');
    }
  }

  async function loadChatHistory() {
    const history = await getStoredChatHistory();
    messagesEl.innerHTML = '';
    history.forEach(renderHistoryItem);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function persistMessage(role, content) {
    const history = await getStoredChatHistory();
    history.push({ role, content });
    await setStoredChatHistory(history);
  }

  async function getStoredSettings() {
    const out = await chrome.storage.local.get([
      'backendUrl', 'apiKey', 'jwt', 'user',
      'llmProvider', 'llmApiKey', 'llmModel'
    ]);
    const provider = out.llmProvider || 'claude';
    return {
      backendUrl: out.backendUrl || DEFAULT_BACKEND,
      apiKey: out.apiKey || '',
      jwt: out.jwt || '',
      user: out.user || null,
      llmProvider: provider,
      llmApiKey: out.llmApiKey || '',
      llmModel: out.llmModel || DEFAULT_MODELS[provider],
    };
  }

  function getAuthToken(settings) {
    return (settings && (settings.jwt || settings.apiKey)) || '';
  }

  function getWsUrl(backendUrl, token) {
    const base = backendUrl.replace(/^http/, 'ws');
    const sep = base.includes('?') ? '&' : '?';
    return token ? `${base}/ws${sep}token=${encodeURIComponent(token)}` : `${base}/ws`;
  }

  async function applyAuthState() {
    const s = await getStoredSettings();
    const hasAuth = !!(s.jwt || s.apiKey);
    if (!hasAuth) {
      authView.classList.remove('hidden');
      mainFlow.classList.add('hidden');
      userLabel.textContent = '';
      connectorsBtn.classList.add('hidden');
      syncConnectorsColumn();
      logoutBtn.classList.add('hidden');
      authBackendUrl.value = s.backendUrl;
      return;
    }
    authView.classList.add('hidden');
    mainFlow.classList.remove('hidden');
    showChatPage();
    loadChatHistory();
    if (s.user) {
      userLabel.textContent = s.user.email;
      connectorsBtn.classList.remove('hidden');
      syncConnectorsColumn();
      logoutBtn.classList.remove('hidden');
    } else {
      userLabel.textContent = 'Using API key';
      connectorsBtn.classList.add('hidden');
      syncConnectorsColumn();
      logoutBtn.classList.add('hidden');
    }
  }

  authLoginBtn.addEventListener('click', async () => {
    const backendUrl = (authBackendUrl.value || DEFAULT_BACKEND).trim();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      setStatus('Email and password required', true);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      await chrome.storage.local.set({
        backendUrl,
        jwt: data.token,
        user: data.user,
      });
      authPassword.value = '';
      setStatus('Signed in.');
      applyAuthState();
    } catch (e) {
      setStatus(e.message || 'Login failed', true);
    }
  });

  authRegisterBtn.addEventListener('click', async () => {
    const backendUrl = (authBackendUrl.value || DEFAULT_BACKEND).trim();
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      setStatus('Email and password required', true);
      return;
    }
    if (password.length < 6) {
      setStatus('Password must be at least 6 characters', true);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      await chrome.storage.local.set({
        backendUrl,
        jwt: data.token,
        user: data.user,
      });
      authPassword.value = '';
      setStatus('Account created.');
      applyAuthState();
    } catch (e) {
      setStatus(e.message || 'Registration failed', true);
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await chrome.storage.local.remove(['jwt', 'user']);
    setStatus('Signed out.');
    applyAuthState();
  });

  connectorsBtn.addEventListener('click', () => showConnectorsPage());
  backFromConnectors.addEventListener('click', () => showChatPage());
  authOpenSettings.addEventListener('click', () => showSettingsPage(true));
  backFromSettings.addEventListener('click', async () => {
    const s = await getStoredSettings();
    const hasAuth = !!(s.jwt || s.apiKey);
    if (settingsOpenedFromAuth && !hasAuth) {
      authView.classList.remove('hidden');
      mainFlow.classList.add('hidden');
      settingsOpenedFromAuth = false;
    } else {
      showChatPage();
    }
  });

  let connectService = null;
  connectSubmit.addEventListener('click', async () => {
    const s = await getStoredSettings();
    if (!s.jwt) return;
    const key = connectApiKey.value.trim();

    if (pendingPresetConfig) {
      if (!key) return;
      try {
        const config = {
          ...pendingPresetConfig.config,
          env: { ...(pendingPresetConfig.config.env || {}), [pendingPresetConfig.envKey]: key },
        };
        await addMcpServer(config);
        const name = pendingPresetConfig.name;
        connectModal.classList.add('hidden');
        connectApiKey.value = '';
        pendingPresetConfig = null;
        setStatus(`Connected ${name}. Added to your connectors.`);
        loadConnectors();
      } catch (e) {
        setStatus(e.message || 'Connect failed', true);
      }
      return;
    }

    if (!connectService) return;
    if (!key) return;
    const body = connectService === 'google'
      ? { service: connectService, refresh_token: key }
      : { service: connectService, api_key: key };
    try {
      const res = await fetch(`${s.backendUrl}/users/me/connectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.jwt}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      connectModal.classList.add('hidden');
      connectApiKey.value = '';
      connectService = null;
      loadConnectors();
    } catch (e) {
      setStatus(e.message || 'Connect failed', true);
    }
  });
  connectCancel.addEventListener('click', () => {
    connectModal.classList.add('hidden');
    connectService = null;
    pendingPresetConfig = null;
  });

  async function loadConnectors() {
    const s = await getStoredSettings();
    if (!s.jwt) return;
    try {
      const [connRes, mcpRes] = await Promise.all([
        fetch(`${s.backendUrl}/users/me/connectors`, { headers: { Authorization: `Bearer ${s.jwt}` } }),
        fetch(`${s.backendUrl}/api/mcp-servers/config`, { headers: { Authorization: `Bearer ${s.jwt}` } }),
      ]);
      const connData = await connRes.json();
      const mcpList = mcpRes.ok ? (await mcpRes.json()).servers : [];
      const mcpServers = Array.isArray(mcpList) ? mcpList : [];
      const connectedMcpIds = new Set(mcpServers.map((x) => x.id));

      connectorsList.innerHTML = '';
      (connData.connectors || []).forEach((c) => {
        const div = document.createElement('div');
        div.className = 'connector-item' + (c.connected ? ' connected' : '');
        div.innerHTML = `
          <div class="connector-info">
            <strong>${escapeHtml(c.name)}</strong>
            <span>${escapeHtml(c.description || '')}</span>
          </div>
          <button type="button" data-service="${escapeHtml(c.service)}" data-connected="${c.connected}">
            ${c.connected ? 'Disconnect' : 'Connect'}
          </button>
        `;
        const btn = div.querySelector('button');
        btn.addEventListener('click', async () => {
          if (c.connected) {
            const r = await fetch(`${s.backendUrl}/users/me/connectors/${c.service}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${s.jwt}` },
            });
            if (r.ok) loadConnectors();
          } else {
            connectService = c.service;
            connectModalTitle.textContent = `Connect ${c.name}`;
            connectApiKey.value = '';
            if (c.service === 'google') {
              connectLabelText.textContent = 'Refresh token';
              connectApiKey.placeholder = 'Or use Sign in with Google below';
              if (connectHint) {
                connectHint.innerHTML = 'Or <a href="#" id="google-oauth-link">Sign in with Google</a> to connect (opens in new tab).';
                connectHint.classList.remove('hidden');
              }
              const oauthLink = document.getElementById('google-oauth-link');
              if (oauthLink) {
                oauthLink.onclick = (e) => {
                  e.preventDefault();
                  chrome.tabs.create({ url: `${s.backendUrl}/auth/google?token=${encodeURIComponent(s.jwt)}` });
                };
              }
            } else {
              connectLabelText.textContent = 'API Key';
              connectApiKey.placeholder = 'Paste your API key';
              if (connectHint) connectHint.classList.add('hidden');
            }
            connectModal.classList.remove('hidden');
          }
        });
        connectorsList.appendChild(div);
      });
      mcpServers.forEach((mcp) => {
        const name = mcp.serverName || mcp.id;
        const div = document.createElement('div');
        div.className = 'connector-item connected';
        div.innerHTML = `
          <div class="connector-info">
            <strong>${escapeHtml(name)}</strong>
            <span>MCP server · extra tools</span>
          </div>
          <button type="button" data-mcp-id="${escapeHtml(mcp.id)}">Disconnect</button>
        `;
        div.querySelector('button').addEventListener('click', async () => {
          await removeMcpServer(mcp.id);
          setStatus('Disconnected.');
          loadConnectors();
        });
        connectorsList.appendChild(div);
      });

      if (mcpPresetsList) {
        mcpPresetsList.innerHTML = '';
        STUDENT_MCP_PRESETS.filter((preset) => !connectedMcpIds.has(preset.id)).forEach((preset) => {
          const div = document.createElement('div');
          div.className = 'connector-item';
          div.innerHTML = `
            <div class="connector-info">
              <strong>${escapeHtml(preset.name)}</strong>
              <span>${escapeHtml(preset.description)}</span>
            </div>
            <button type="button" data-preset-id="${escapeHtml(preset.id)}">Connect</button>
          `;
          div.querySelector('button').addEventListener('click', async () => {
            if (preset.needsEnv) {
              pendingPresetConfig = preset;
              connectModalTitle.textContent = `Connect ${preset.name}`;
              connectLabelText.textContent = preset.envLabel || 'API key';
              connectApiKey.value = '';
              connectApiKey.placeholder = 'Paste your API key';
              if (connectHint) connectHint.classList.add('hidden');
              connectModal.classList.remove('hidden');
              return;
            }
            try {
              await addMcpServer(preset.config);
              setStatus(`Connected ${preset.name}. Added to your connectors.`);
              loadConnectors();
            } catch (e) {
              setStatus(e.message || 'Connect failed', true);
            }
          });
          mcpPresetsList.appendChild(div);
        });
      }
    } catch (e) {
      connectorsList.innerHTML = `<p class="error">${escapeHtml(e.message || 'Failed to load connectors')}</p>`;
    }
  }

  function renderMcpResultEntry(entry, append) {
    const server = entry.server || {};
    const title = server.title || server.name || 'Unnamed';
    const desc = server.description || '';
    const div = document.createElement('div');
    div.className = 'connector-item mcp-result-item';
    div.innerHTML = `
      <div class="connector-info"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(desc.slice(0, 120))}${desc.length > 120 ? '…' : ''}</span></div>
      <button type="button" data-connect>Connect</button>
    `;
    div.querySelector('[data-connect]').addEventListener('click', async () => {
      try {
        const config = defaultConfigFromServer(entry);
        await addMcpServer(config);
        setStatus('Connected. Added to your connectors.');
        loadConnectors();
      } catch (e) {
        setStatus(e.message || 'Connect failed', true);
      }
    });
    if (append) mcpResults.appendChild(div); else mcpResults.insertBefore(div, mcpResults.querySelector('.mcp-load-more-wrap'));
  }

  async function searchMcpServers(cursor) {
    const s = await getStoredSettings();
    const q = (mcpSearchInput?.value ?? '').trim();
    if (!cursor) mcpResults.innerHTML = '<p class="connectors-hint">Loading…</p>';
    try {
      let url = `${s.backendUrl}/api/mcp-servers?limit=25`;
      if (cursor) url += '&cursor=' + encodeURIComponent(cursor);
      if (q) url += '&search=' + encodeURIComponent(q);
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Search failed');
      const servers = data.servers ?? [];
      const nextCursor = data.metadata?.nextCursor || '';
      if (!cursor) mcpResults.innerHTML = '';
      servers.forEach((entry) => renderMcpResultEntry(entry, true));
      const loadMoreWrap = mcpResults.querySelector('.mcp-load-more-wrap');
      if (loadMoreWrap) loadMoreWrap.remove();
      if (servers.length === 0 && !cursor) {
        mcpResults.innerHTML = '<p class="connectors-hint">No servers found. Try another search or browse <a href="https://www.pulsemcp.com/servers" target="_blank" rel="noopener">PulseMCP</a>.</p>';
        return;
      }
      if (nextCursor && !q) {
        const wrap = document.createElement('div');
        wrap.className = 'mcp-load-more-wrap';
        wrap.style.cssText = 'padding:8px;text-align:center;';
        wrap.innerHTML = '<button type="button" id="mcp-load-more-btn">Load more</button>';
        wrap.querySelector('#mcp-load-more-btn').addEventListener('click', () => searchMcpServers(nextCursor));
        mcpResults.appendChild(wrap);
      }
    } catch (e) {
      mcpResults.innerHTML = `<p class="error">${escapeHtml(e.message || 'Search failed')}</p>`;
    }
  }

  mcpSearchBtn?.addEventListener('click', () => searchMcpServers());
  mcpSearchInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchMcpServers(); });

  clearChatBtn.addEventListener('click', async () => {
    await setStoredChatHistory([]);
    messagesEl.innerHTML = '';
    setStatus('Chat cleared.');
  });

  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  settingsBtn.addEventListener('click', () => showSettingsPage(false));
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
    await applyAuthState();
  });

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;
    const s = await getStoredSettings();
    const token = getAuthToken(s);
    if (!s.backendUrl) {
      setStatus('Set Backend URL in settings.', true);
      return;
    }
    if (!token) {
      setStatus('Sign in or set Backend API Key in settings.', true);
      return;
    }
    if (!s.llmApiKey) {
      setStatus('Set LLM API Key in settings.', true);
      return;
    }

    inputEl.value = '';
    sendBtn.disabled = true;
    appendMessage('user', text);
    persistMessage('user', text);

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

    const wsUrl = getWsUrl(s.backendUrl, token);
    const ws = new WebSocket(wsUrl);
    let currentBubble = null;

    ws.onopen = () => setStatus('Connected.');

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
            provider: s.llmProvider,
            api_key: s.llmApiKey,
            model: s.llmModel,
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
          if (currentBubble) {
            const finalText = currentBubble.textContent;
            currentBubble.innerHTML = renderAssistantContent(finalText);
            currentBubble.dataset.streaming = '';
            persistMessage('assistant', finalText);
          }
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

  getStoredSettings().then((s) => {
    applyAuthState();
    if (s.backendUrl && getAuthToken(s)) setStatus(`Backend: ${s.backendUrl} · ${s.llmProvider}`);
  });
})();
