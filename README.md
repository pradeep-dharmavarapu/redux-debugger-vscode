# Redux State Debugger — VS Code Extension

> Real-time Redux state inspector and unnecessary re-render detector for React applications, built directly into VS Code.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.74+-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Why This Exists

While leading frontend architecture for a large-scale React platform at T-Mobile, I kept running into the same problem: engineers couldn't easily see *why* their components were slow. They'd add `console.log` statements everywhere, open Chrome DevTools in one window and VS Code in another, and lose context constantly.

So I built this extension — a Redux state visualiser and re-render detector that lives *inside your editor*, where you're actually writing code.

---

## Features

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

---

## Setup

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
        trackRerenders: true,
      })
    ),
});

export default store;
```

### Step 2 — (Optional) Track component re-renders

```typescript
import { withRerenderTracking } from './src/middleware';

function MyExpensiveComponent({ data, onUpdate }: Props) {
  return <div>{/* ... */}</div>;
}

// Wrap with tracker — zero cost in production (NODE_ENV check built in)
export default withRerenderTracking(MyExpensiveComponent, 'MyExpensiveComponent');
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
    │   └── POSTs to local HTTP server
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
