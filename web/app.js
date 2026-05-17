const state = {
  sessionId: new URLSearchParams(location.search).get('session') || localStorage.getItem('reduxDebuggerSession') || 'default',
  lastEventId: 0,
  data: {
    state: {},
    actions: [],
    rerenders: [],
  },
};

const els = {
  sessionInput: document.getElementById('sessionInput'),
  connectionState: document.getElementById('connectionState'),
  actionCount: document.getElementById('actionCount'),
  stateKeyCount: document.getElementById('stateKeyCount'),
  renderCount: document.getElementById('renderCount'),
  lastEvent: document.getElementById('lastEvent'),
  stateTree: document.getElementById('stateTree'),
  actionList: document.getElementById('actionList'),
  renderList: document.getElementById('renderList'),
  setupSnippet: document.getElementById('setupSnippet'),
  stateFilter: document.getElementById('stateFilter'),
  actionFilter: document.getElementById('actionFilter'),
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function formatValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `Object(${Object.keys(value).length})`;
  if (typeof value === 'string') return `"${value}"`;
  return String(value);
}

function renderTree(value, filter = '', keyName = 'root') {
  const normalizedFilter = filter.trim().toLowerCase();
  if (value === null || typeof value !== 'object') {
    return `<span class="key">${escapeHtml(keyName)}</span>: <span class="value">${escapeHtml(formatValue(value))}</span>`;
  }

  const entries = Object.entries(value)
    .filter(([key]) => !normalizedFilter || key.toLowerCase().includes(normalizedFilter));

  if (!entries.length) return '<span class="empty">No matching keys.</span>';

  return entries.map(([key, nested]) => {
    if (nested !== null && typeof nested === 'object') {
      return `<details open><summary><span class="key">${escapeHtml(key)}</span> <span class="value">${escapeHtml(formatValue(nested))}</span></summary>${renderTree(nested, '', key)}</details>`;
    }
    return `<div><span class="key">${escapeHtml(key)}</span>: <span class="value">${escapeHtml(formatValue(nested))}</span></div>`;
  }).join('');
}

function renderActions() {
  const filter = els.actionFilter.value.trim().toLowerCase();
  const actions = state.data.actions.filter(action => !filter || action.type.toLowerCase().includes(filter));
  if (!actions.length) {
    els.actionList.className = 'timeline empty';
    els.actionList.textContent = 'No matching actions.';
    return;
  }

  els.actionList.className = 'timeline';
  els.actionList.innerHTML = actions.map(action => {
    const durationClass = action.duration > 16 ? 'badge slow' : 'badge';
    return `<article class="entry">
      <div class="entry-header">
        <strong>${escapeHtml(action.type)}</strong>
        <span class="${durationClass}">${escapeHtml(action.duration ?? 0)}ms</span>
      </div>
      <small>${new Date(action.timestamp).toLocaleTimeString()}</small>
      <pre>${escapeHtml(JSON.stringify(action.payload ?? {}, null, 2))}</pre>
    </article>`;
  }).join('');
}

function renderRenders() {
  if (!state.data.rerenders.length) {
    els.renderList.className = 'timeline empty';
    els.renderList.textContent = 'No render signals received yet.';
    return;
  }

  els.renderList.className = 'timeline';
  els.renderList.innerHTML = state.data.rerenders.map(item => `<article class="entry">
    <div class="entry-header">
      <strong>${escapeHtml(item.component)}</strong>
      <span class="badge hot">${escapeHtml(item.count)} renders</span>
    </div>
    <small>${escapeHtml(item.file || 'file unknown')}</small>
    <pre>${escapeHtml((item.props || []).join(', ') || 'No changed props reported')}</pre>
  </article>`).join('');
}

function updateSnippet() {
  const endpoint = location.origin;
  els.setupSnippet.textContent = `import { reduxDebuggerMiddleware, withRerenderTracking } from 'redux-state-debugger/middleware';

const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(
      reduxDebuggerMiddleware({
        endpoint: '${endpoint}',
        sessionId: '${state.sessionId}',
        enabled: process.env.NODE_ENV === 'development',
      })
    ),
});

export default withRerenderTracking(MyComponent, 'MyComponent', {
  endpoint: '${endpoint}',
  sessionId: '${state.sessionId}',
});`;
}

function render() {
  els.sessionInput.value = state.sessionId;
  els.actionCount.textContent = state.data.actions.length;
  els.stateKeyCount.textContent = Object.keys(state.data.state || {}).length;
  els.renderCount.textContent = state.data.rerenders.length;

  const hasState = state.data.state && Object.keys(state.data.state).length;
  els.stateTree.className = hasState ? 'tree' : 'tree empty';
  els.stateTree.innerHTML = hasState ? renderTree(state.data.state, els.stateFilter.value) : 'No state received yet.';

  renderActions();
  renderRenders();
  updateSnippet();
}

async function poll() {
  try {
    const response = await fetch(`/api/events?session=${encodeURIComponent(state.sessionId)}&after=${state.lastEventId}`, {
      cache: 'no-store',
    });
    const payload = await response.json();
    state.data = payload;
    if (payload.events.length) {
      state.lastEventId = payload.events[payload.events.length - 1].id;
      els.lastEvent.textContent = new Date(payload.events[payload.events.length - 1].timestamp).toLocaleTimeString();
    }
    els.connectionState.textContent = payload.events.length ? 'Receiving events' : 'Connected';
    render();
  } catch {
    els.connectionState.textContent = 'Disconnected';
  } finally {
    setTimeout(poll, 1000);
  }
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(item => item.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${tab.dataset.tab}Panel`).classList.add('active');
  });
});

document.getElementById('newSessionButton').addEventListener('click', async () => {
  const response = await fetch('/api/session', { method: 'POST' });
  const payload = await response.json();
  state.sessionId = payload.sessionId;
  state.lastEventId = 0;
  localStorage.setItem('reduxDebuggerSession', state.sessionId);
  history.replaceState(null, '', `?session=${encodeURIComponent(state.sessionId)}`);
  render();
});

document.getElementById('copySnippetButton').addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.setupSnippet.textContent);
});

document.getElementById('clearButton').addEventListener('click', async () => {
  await fetch('/api/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: state.sessionId }),
  });
  state.data = { state: {}, actions: [], rerenders: [] };
  state.lastEventId = 0;
  render();
});

els.sessionInput.addEventListener('change', () => {
  state.sessionId = els.sessionInput.value.trim() || 'default';
  state.lastEventId = 0;
  localStorage.setItem('reduxDebuggerSession', state.sessionId);
  history.replaceState(null, '', `?session=${encodeURIComponent(state.sessionId)}`);
  render();
});

els.stateFilter.addEventListener('input', render);
els.actionFilter.addEventListener('input', renderActions);

localStorage.setItem('reduxDebuggerSession', state.sessionId);
render();
poll();
