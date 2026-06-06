# Redux State Debugger

> Real-time Redux state inspector and unnecessary re-render detector for React applications, available in VS Code and as a Vercel-deployable web dashboard.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.74+-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Why This Exists

While leading frontend architecture for a large-scale React platform at T-Mobile, I kept running into the same problem: engineers couldn't easily see *why* their components were slow. They'd add `console.log` statements everywhere, open Chrome DevTools in one window and VS Code in another, and lose context constantly.

So I built this extension — a Redux state visualiser and re-render detector that lives *inside your editor*, where you're actually writing code.

---

## Features

### Web Dashboard
Deploy the debugger UI to Vercel and connect a running React/Redux app with a session id. The dashboard shows state, actions, render hotspots, payload previews, latency, and setup code for the active session.

### VS Code Debugger Dashboard
Open `Redux Debugger: Open Dashboard` inside the Extension Development Host or installed extension. It shows every top-level Redux slice, the action that last changed it, nested state paths, reducer duration, action payloads, and render hotspots.

### 🌳 Redux State Tree
Visualise your entire Redux store as an interactive tree directly in the VS Code sidebar. Updates in real time as actions are dispatched.

### ⚡ Action History
See every dispatched action with:
- Action type and payload
- Timestamp
- Processing duration (ms)

### 🚨 Re-render Detector
Automatically flags components that are re-rendering unnecessarily:
- Shows which components re-rendered and how many times
- Lists which props changed (or didn't change — the common culprit)
- Links directly to the component file
- Warning threshold configurable per project

### 📊 Performance Report Export
Export a full JSON report of actions and re-renders for post-session analysis.

---

## Real-World Validation

This extension includes an integration suite that exercises the compiled debugger against realistic Redux workflows, not just isolated unit tests.

Run:

```bash
npm test
```

The suite verifies:

- Auth, cart, todos, search, dashboard, and performance-style Redux actions are captured by the middleware.
- Initial store state and slice details are captured automatically before the app dispatches any user action.
- State updates, changed slices, and changed state paths are sent to the VS Code debugger endpoint.
- Sensitive fields such as tokens and passwords are redacted before leaving the app.
- A burst of 250 actions is ingested without dropped action/state events.
- Oversized payloads are truncated before transmission.
- Invalid debugger messages are rejected without crashing the server.
- Repeated component renders are reported with changed prop names.

See [docs/DEBUGGER_PROOF_PLAN.md](docs/DEBUGGER_PROOF_PLAN.md) for the full proof plan, Redux DevTools comparison, and remaining launch-hardening work.

---

## Installation

### From VS Code Marketplace
Search for **"Redux State Debugger"** in the Extensions panel.

### Manual Installation
```bash
git clone https://github.com/pradeep-kumar-dharmavarapu/vscode-redux-debugger
cd vscode-redux-debugger
npm install
npm run package
code --install-extension redux-state-debugger-1.0.0.vsix
```

### Deploy the web dashboard to Vercel

```bash
npm install
npm run build
vercel deploy
```

The deploy uses:
- `web/index.html`, `web/app.js`, and `web/styles.css` for the dashboard
- `api/update.js` for event ingestion
- `api/events.js` for polling dashboard data
- `api/session.js` for quick session creation
- `api/clear.js` for clearing a dashboard session

The included API uses warm serverless memory so the project is immediately deployable. For a public multi-user product, replace `api/_store.js` with durable storage such as Vercel KV, Upstash Redis, or Postgres before launch.

---

## Setup

For a complete real-app walkthrough, see [docs/REAL_APP_SETUP.md](docs/REAL_APP_SETUP.md).

### Step 1 — Add the middleware to your Redux store

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { reduxDebuggerMiddleware } from './src/middleware';
import rootReducer from './reducers';

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      reduxDebuggerMiddleware({
        port: 8765,                              // must match extension port
        enabled: process.env.NODE_ENV === 'development',
        sendInitialState: true,                  // default: populate slices before first action
        trackRerenders: true,
      })
    ),
});

export default store;
```

For a Vercel dashboard session, use the endpoint and session id shown in the dashboard:

```typescript
reduxDebuggerMiddleware({
  endpoint: 'https://your-debugger.vercel.app',
  sessionId: 'session-from-dashboard',
  enabled: process.env.NODE_ENV === 'development',
  sendInitialState: true,
});
```

### Step 2 — (Optional) Track component re-renders

```typescript
import { withRerenderTracking } from './src/middleware';

function MyExpensiveComponent({ data, onUpdate }: Props) {
  return <div>{/* ... */}</div>;
}

// Wrap with tracker — zero cost in production (NODE_ENV check built in)
export default withRerenderTracking(MyExpensiveComponent, 'MyExpensiveComponent', {
  endpoint: 'https://your-debugger.vercel.app',
  sessionId: 'session-from-dashboard',
});
```

### Step 3 — Start the debugger in VS Code

Open the Command Palette (`Cmd+Shift+P`) → **Redux Debugger: Start Monitoring**

Run your React app. The sidebar panels will populate automatically.

---

## Configuration

Add to your `.vscode/settings.json`:

```json
{
  "reduxDebugger.enableRerenderDetection": true,
  "reduxDebugger.rerenderThreshold": 3,
  "reduxDebugger.maxActionHistory": 100,
  "reduxDebugger.highlightUnnecessaryRerenders": true
}
```

| Setting | Default | Description |
|---|---|---|
| `enableRerenderDetection` | `true` | Enable re-render tracking |
| `rerenderThreshold` | `3` | Re-renders before flagging as unnecessary |
| `maxActionHistory` | `100` | Max actions to keep in history |
| `highlightUnnecessaryRerenders` | `true` | Show warning notification |

---

## The Problem This Solves

**Before this extension:**
```
Engineer suspects performance issue
→ Opens Chrome DevTools
→ Switches between DevTools and VS Code
→ Adds console.log to component
→ Dispatches action
→ Searches through console output
→ Tries to correlate with Redux DevTools
→ 20 minutes wasted
```

**With Redux State Debugger:**
```
Engineer opens VS Code sidebar
→ Sees re-render warning on component in real time
→ Clicks component → opens file directly
→ Fixes the memoisation issue
→ 2 minutes
```

This is the exact workflow improvement I built at T-Mobile that reduced debugging time across a team of 10+ engineers.

---

## Architecture

```
React App (browser)
    │
    ├── Redux Middleware (middleware.ts)
    │   ├── Intercepts every dispatched action
    │   ├── Captures state snapshots
    │   └── POSTs to local VS Code server or Vercel API
    │
    └── withRerenderTracking HOC
        └── Tracks component render counts + prop changes

VS Code Extension
    │
    ├── HTTP Server (port 8765)
    │   └── Receives data from browser
    │
    ├── ReduxStateTreeProvider → State Tree panel
    ├── ActionHistoryProvider  → Action History panel
    └── RerenderDetectorProvider → Re-render Detector panel

Vercel Dashboard
    │
    ├── /api/update  → receives action, state, and render events
    ├── /api/events  → dashboard polling endpoint
    ├── /api/session → session id creation
    └── /web/*       → browser dashboard UI
```

---

## Contributing

PRs welcome. Key areas for contribution:
- True WebSocket support (replace HTTP polling)
- Time-travel debugging (replay actions)
- Integration with Redux Toolkit's RTK Query
- Support for Zustand and Jotai

---

## Author

Built by [Pradeep Kumar Dharmavarapu](https://linkedin.com/in/pradeep-kumar-dharmavarapu) — Frontend Architect at Wipro, working on T-Mobile, Hitachi Energy, ABB, and Visa platforms.

This extension grew out of a real production problem on a large-scale React platform. If it saves you the same debugging pain, give it a ⭐.

---

## License

MIT
