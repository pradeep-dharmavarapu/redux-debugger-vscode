import * as vscode from 'vscode';
import { DebugSession, DebugSnapshot } from '../debug/DebugSession';

export class DashboardPanel {
  private static current: DashboardPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly session: DebugSession
  ) {
    this.panel.webview.options = {
      enableScripts: true,
    };
    this.panel.webview.html = this.getHtml(this.session.getSnapshot());

    this.disposables.push(
      this.session.onDidChange(snapshot => {
        this.panel.webview.postMessage({ type: 'snapshot', snapshot });
      }),
      this.panel.onDidDispose(() => this.dispose())
    );
  }

  static show(context: vscode.ExtensionContext, session: DebugSession) {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(vscode.ViewColumn.One);
      DashboardPanel.current.panel.webview.postMessage({
        type: 'snapshot',
        snapshot: session.getSnapshot(),
      });
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'reduxDebuggerDashboard',
      'Redux Debugger Dashboard',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    DashboardPanel.current = new DashboardPanel(panel, session);
    context.subscriptions.push(DashboardPanel.current);
  }

  dispose() {
    DashboardPanel.current = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }

  private getHtml(snapshot: DebugSnapshot) {
    const nonce = getNonce();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Redux Debugger Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --panel: var(--vscode-sideBar-background);
      --ink: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --line: var(--vscode-panel-border);
      --accent: var(--vscode-button-background);
      --accent-ink: var(--vscode-button-foreground);
      --warn: var(--vscode-editorWarning-foreground);
      --danger: var(--vscode-editorError-foreground);
      --code: var(--vscode-textCodeBlock-background);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }
    button, input { font: inherit; }
    .layout {
      display: grid;
      grid-template-columns: minmax(260px, 320px) minmax(360px, 1fr) minmax(300px, 420px);
      min-height: 100vh;
    }
    .col {
      min-width: 0;
      border-right: 1px solid var(--line);
      background: var(--panel);
    }
    .col:last-child { border-right: 0; }
    .header {
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 16px; }
    h2 { font-size: 13px; text-transform: uppercase; color: var(--muted); letter-spacing: .04em; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
    }
    .metric {
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
    }
    .metric span { display: block; color: var(--muted); font-size: 11px; }
    .metric strong { display: block; margin-top: 5px; font-size: 20px; }
    .search {
      width: calc(100% - 24px);
      margin: 12px;
      padding: 8px 10px;
      color: var(--ink);
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 6px;
    }
    .list { padding: 8px; overflow: auto; max-height: calc(100vh - 160px); }
    .slice, .action, .render {
      width: 100%;
      text-align: left;
      color: var(--ink);
      background: var(--bg);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .slice.active, .action.active {
      outline: 2px solid var(--accent);
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
    }
    .name { font-weight: 700; overflow-wrap: anywhere; }
    .muted { color: var(--muted); font-size: 12px; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 7px;
      background: var(--accent);
      color: var(--accent-ink);
      font-size: 11px;
      white-space: nowrap;
    }
    .badge.warn { background: transparent; color: var(--warn); border: 1px solid var(--warn); }
    .content { padding: 14px; overflow: auto; max-height: calc(100vh - 51px); }
    .state-path {
      display: grid;
      grid-template-columns: minmax(160px, 1fr) auto auto;
      gap: 10px;
      padding: 7px 0;
      border-bottom: 1px solid var(--line);
    }
    pre {
      margin: 12px 0 0;
      padding: 12px;
      background: var(--code);
      border: 1px solid var(--line);
      border-radius: 6px;
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .empty {
      color: var(--muted);
      padding: 20px;
      text-align: center;
    }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
      .col { border-right: 0; border-bottom: 1px solid var(--line); }
      .list, .content { max-height: none; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <section class="col">
      <div class="header">
        <div>
          <h1>Store Slices</h1>
          <p class="muted" id="updatedAt">Waiting for app events</p>
        </div>
      </div>
      <div class="metric-grid">
        <div class="metric"><span>Slices</span><strong id="sliceCount">0</strong></div>
        <div class="metric"><span>Actions</span><strong id="actionCount">0</strong></div>
        <div class="metric"><span>Renders</span><strong id="renderCount">0</strong></div>
      </div>
      <input id="sliceSearch" class="search" placeholder="Filter slices or state paths">
      <div id="sliceList" class="list"></div>
    </section>

    <section class="col">
      <div class="header">
        <div>
          <h1 id="inspectorTitle">State Inspector</h1>
          <p class="muted" id="inspectorSubtitle">Select a slice to inspect every state path.</p>
        </div>
      </div>
      <div id="inspector" class="content"></div>
    </section>

    <section class="col">
      <div class="header">
        <div>
          <h1>Action Timeline</h1>
          <p class="muted">Shows exactly which slices changed.</p>
        </div>
      </div>
      <input id="actionSearch" class="search" placeholder="Filter actions or changed slices">
      <div id="actionList" class="list"></div>
      <div class="header"><h2>Render Hotspots</h2></div>
      <div id="renderList" class="list"></div>
    </section>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let snapshot = ${JSON.stringify(snapshot)};
    let selectedSlice = '';
    let selectedAction = '';

    const el = id => document.getElementById(id);
    const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));

    function flatten(value, prefix = '') {
      if (value === null || typeof value !== 'object') {
        return [{ path: prefix || 'value', type: value === null ? 'null' : typeof value, value }];
      }
      const entries = Array.isArray(value)
        ? value.map((item, index) => [String(index), item])
        : Object.entries(value);
      if (!entries.length) {
        return [{ path: prefix || 'value', type: Array.isArray(value) ? 'array' : 'object', value }];
      }
      return entries.flatMap(([key, nested]) => {
        const nextPath = prefix ? prefix + '.' + key : key;
        const own = [{ path: nextPath, type: getType(nested), value: preview(nested) }];
        if (nested !== null && typeof nested === 'object') {
          return own.concat(flatten(nested, nextPath));
        }
        return own;
      });
    }

    function getType(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }

    function preview(value) {
      if (value === null) return 'null';
      if (Array.isArray(value)) return 'Array(' + value.length + ')';
      if (typeof value === 'object') return 'Object(' + Object.keys(value).length + ')';
      if (typeof value === 'string') return '"' + value + '"';
      return String(value);
    }

    function render() {
      const slices = snapshot.slices || [];
      const actions = snapshot.actions || [];
      const rerenders = snapshot.rerenders || [];
      if (!selectedSlice && slices.length) selectedSlice = slices[0].name;

      el('sliceCount').textContent = slices.length;
      el('actionCount').textContent = actions.length;
      el('renderCount').textContent = rerenders.length;
      el('updatedAt').textContent = snapshot.lastUpdatedAt
        ? 'Updated ' + new Date(snapshot.lastUpdatedAt).toLocaleTimeString()
        : 'Waiting for app events';

      renderSlices();
      renderInspector();
      renderActions();
      renderRenders();
    }

    function renderSlices() {
      const query = el('sliceSearch').value.trim().toLowerCase();
      const slices = (snapshot.slices || []).filter(slice => {
        if (!query) return true;
        return slice.name.toLowerCase().includes(query) ||
          flatten(slice.value).some(row => row.path.toLowerCase().includes(query));
      });

      if (!slices.length) {
        el('sliceList').innerHTML = '<div class="empty">No slices received yet. Dispatch a Redux action in your app.</div>';
        return;
      }

      el('sliceList').innerHTML = slices.map(slice => '<button class="slice ' + (slice.name === selectedSlice ? 'active' : '') + '" data-slice="' + escapeHtml(slice.name) + '">' +
        '<div class="row"><span class="name">' + escapeHtml(slice.name) + '</span><span class="badge">' + escapeHtml(slice.type) + '</span></div>' +
        '<p class="muted">' + slice.keys + ' keys · ' + slice.size + ' bytes</p>' +
        '<p class="muted">Last changed by: ' + escapeHtml(slice.lastChangedBy || 'unknown') + '</p>' +
      '</button>').join('');

      document.querySelectorAll('[data-slice]').forEach(button => {
        button.addEventListener('click', () => {
          selectedSlice = button.dataset.slice;
          render();
        });
      });
    }

    function renderInspector() {
      const slice = (snapshot.slices || []).find(item => item.name === selectedSlice);
      if (!slice) {
        el('inspector').innerHTML = '<div class="empty">Select a slice to inspect state.</div>';
        return;
      }

      el('inspectorTitle').textContent = slice.name;
      el('inspectorSubtitle').textContent = slice.type + ' · ' + slice.keys + ' direct keys · ' + slice.size + ' bytes';
      const paths = flatten(slice.value).slice(0, 500);

      el('inspector').innerHTML =
        '<h2>State paths</h2>' +
        paths.map(row => '<div class="state-path"><span class="name">' + escapeHtml(row.path) + '</span><span class="badge">' + escapeHtml(row.type) + '</span><span class="muted">' + escapeHtml(preview(row.value)) + '</span></div>').join('') +
        '<h2 style="margin-top:18px">Raw slice state</h2><pre>' + escapeHtml(JSON.stringify(slice.value, null, 2)) + '</pre>';
    }

    function renderActions() {
      const query = el('actionSearch').value.trim().toLowerCase();
      const actions = (snapshot.actions || []).filter(action => {
        const slices = action.changedSlices || Object.keys(action.stateDiff || {});
        return !query || action.type.toLowerCase().includes(query) || slices.some(slice => slice.toLowerCase().includes(query));
      });

      if (!actions.length) {
        el('actionList').innerHTML = '<div class="empty">No actions yet.</div>';
        return;
      }

      el('actionList').innerHTML = actions.map(action => {
        const changed = action.changedSlices || Object.keys(action.stateDiff || {});
        const badges = changed.length
          ? changed.map(slice => '<span class="badge">' + escapeHtml(slice) + '</span>').join(' ')
          : '<span class="badge warn">no state change detected</span>';
        return '<button class="action ' + (action.type === selectedAction ? 'active' : '') + '" data-action="' + escapeHtml(action.type) + '">' +
          '<div class="row"><span class="name">' + escapeHtml(action.type) + '</span><span class="muted">' + escapeHtml(action.duration || 0) + 'ms</span></div>' +
          '<p class="muted">' + new Date(action.timestamp).toLocaleTimeString() + '</p>' +
          '<div>' + badges + '</div>' +
        '</button>';
      }).join('');
    }

    function renderRenders() {
      const rerenders = snapshot.rerenders || [];
      if (!rerenders.length) {
        el('renderList').innerHTML = '<div class="empty">No render hotspots detected.</div>';
        return;
      }
      el('renderList').innerHTML = rerenders.map(item => '<div class="render">' +
        '<div class="row"><span class="name">' + escapeHtml(item.component) + '</span><span class="badge warn">' + item.count + ' renders</span></div>' +
        '<p class="muted">' + escapeHtml(item.file || 'file unknown') + '</p>' +
        '<p class="muted">Changed props: ' + escapeHtml((item.props || []).join(', ') || 'none reported') + '</p>' +
      '</div>').join('');
    }

    el('sliceSearch').addEventListener('input', renderSlices);
    el('actionSearch').addEventListener('input', renderActions);
    window.addEventListener('message', event => {
      if (event.data.type === 'snapshot') {
        snapshot = event.data.snapshot;
        render();
      }
    });
    render();
  </script>
</body>
</html>`;
  }
}

function getNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
