# Redux State Debugger

> Real-time Redux state inspector and unnecessary re-render detector for React applications — lives inside VS Code, where you're actually writing code.

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code%20Marketplace-Install-blue?logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=pradeep-kumar-dharmavarapu.redux-state-debugger)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://marketplace.visualstudio.com/items?itemName=pradeep-kumar-dharmavarapu.redux-state-debugger)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.74+-blueviolet)](https://code.visualstudio.com/)

---

## Why This Exists

While leading frontend architecture for a large-scale React platform at T-Mobile, I kept running into the same problem: engineers couldn't easily see *why* their components were slow.

The usual workflow looked like this:

```
Suspect performance issue
→ Open Chrome DevTools
→ Switch between DevTools and VS Code constantly
→ Add console.log statements everywhere
→ Search through Redux DevTools in a separate tab
→ Try to correlate actions with component re-renders
→ 20 minutes wasted per issue
```

I built this extension to collapse that into:

```
See re-render warning in VS Code sidebar
→ Click component → file opens directly
→ Fix the memoisation issue
→ 2 minutes
```

It reduced debugging time across a team of 10+ engineers at T-Mobile and is now available for anyone running React + Redux.

---

## Features

### 🌳 Redux State Tree
Visualise your entire Redux store as an interactive tree directly in the VS Code sidebar. Updates in real time as actions are dispatched — no tab switching required.

### ⚡ Action History
Every dispatched action tracked with:
- Action type and payload
- Timestamp
- Processing duration (ms)

### 🚨 Re-render Detector
Automatically flags components re-rendering unnecessarily:
- Which components re-rendered and how many times
- Which props changed — and which didn't (the common culprit)
- Direct link to the component file
- Configurable warning threshold per project

### 📊 VS Code Dashboard
Open `Redux Debugger: Open Dashboard` from the Command Palette for a full panel view — every Redux slice, last action, nested state paths, reducer duration, and render hotspots in one place.

### 🌐 Vercel Web Dashboard
Deploy the debugger UI to Vercel and connect any running React/Redux app via session ID. Full state, action, and render visualisation accessible from any browser.

### 📤 Performance Report Export
Export a full JSON report of actions and re-renders for post-session analysis or sharing with your team.

---

## Install

**From VS Code** (recommended):

Search **"Redux State Debugger"** in the Extensions panel (`Ctrl+Shift+X`), or:

[![Install from Marketplace](https://img.shields.io/badge/Install-VS%20Code%20Marketplace-blue?logo=visual-studio-code&style=for-the-badge)](https://marketplace.visualstudio.com/items?itemName=pradeep-kumar-dharmavarapu.redux-state-debugger)

**From source:**
```bash
git clone https://github.com/pradeep-kumar-dharmavarapu/vscode-redux-debugger
cd vscode-redux-debugger
npm install
npm run package
code --install-extension redux-state-debugger-1.0.0.vsix
```

**Deploy web dashboard to Vercel:**
```bash
npm run build
vercel deploy
```

---

## Setup

For a full walkthrough see [docs/REAL_APP_SETUP.md](docs/REAL_APP_SETUP.md).

### Step 1 — Add middleware to your Redux store

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { reduxDebuggerMiddleware } from './src/middleware';

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      reduxDebuggerMiddleware({
        port: 8765,
        enabled: process.env.NODE_ENV === 'development',
        trackRerenders: true,
      })
    ),
});
```

### Step 2 — (Optional) Track component re-renders

```typescript
import { withRerenderTracking } from './src/middleware';

function MyExpensiveComponent({ data, onUpdate }: Props) {
  return <div>{/* ... */}</div>;
}

// Zero cost in production — NODE_ENV check is built in
export default withRerenderTracking(MyExpensiveComponent, 'MyExpensiveComponent');
```

### Step 3 — Start monitoring

`Cmd+Shift+P` → **Redux Debugger: Start Monitoring**

The sidebar panels populate automatically as your app runs.

---

## Configuration

```json
// .vscode/settings.json
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

## Architecture

```
React App (browser)
  │
  ├── Redux Middleware (middleware.ts)
  │     ├── Intercepts every dispatched action
  │     ├── Captures state snapshots
  │     └── POSTs to local VS Code server (port 8765) or Vercel API
  │
  └── withRerenderTracking HOC
        └── Tracks render counts + prop diffs per component

VS Code Extension
  │
  ├── HTTP Server (port 8765)
  │     └── Receives events from the browser
  │
  ├── ReduxStateTreeProvider   → State Tree sidebar panel
  ├── ActionHistoryProvider    → Action History sidebar panel
  └── RerenderDetectorProvider → Re-render Detector sidebar panel

Vercel Dashboard
  │
  ├── /api/update   → receives action, state, and render events
  ├── /api/events   → dashboard polling endpoint
  ├── /api/session  → session ID creation
  └── /web/*        → browser dashboard UI
```

---

## Roadmap

- [ ] WebSocket support (replace HTTP polling)
- [ ] Time-travel debugging (replay actions)
- [ ] RTK Query integration
- [ ] Zustand and Jotai support
- [ ] VS Code Marketplace ratings and reviews

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Author

Built by **[Pradeep Kumar Dharmavarapu](https://linkedin.com/in/pradeep-kumar-dharmavarapu)** — Frontend Architect with 9+ years building large-scale React platforms at T-Mobile, Hitachi Energy, ABB, and Visa.

This extension grew out of a real production debugging problem at T-Mobile. If it saves your team the same pain, a ⭐ on this repo goes a long way.

---

## License

MIT — see [LICENSE](LICENSE)
