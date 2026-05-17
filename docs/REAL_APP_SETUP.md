# Real App Setup Guide

This guide proves the extension with a real React + Redux app.

## 1. Run the extension locally

Open this extension project in VS Code:

```bash
cd /Users/pradeep/Projects/redux-debugger-vscode
code .
```

Install and compile:

```bash
npm install
npm run compile
```

Press `F5` and choose `Run Extension`. A second VS Code window opens. That second window is the Extension Development Host.

In the Extension Development Host:

1. Open Command Palette.
2. Run `Redux Debugger: Start Monitoring`.
3. Run `Redux Debugger: Open Dashboard`.
4. Open the Redux Debugger activity bar section.
5. Keep these views visible:
   - Redux State Tree
   - Action History
   - Re-render Detector

To verify the server is alive, open this in a browser:

```text
http://localhost:8765/update
```

You should see a JSON status response. That page is only a status page. Real app events use POST requests.

## 2. Add the middleware to a Redux Toolkit app

In your React app, install or reference this package.

During local development from this repo, the simplest option is to import the middleware by path:

```ts
import { reduxDebuggerMiddleware } from '/Users/pradeep/Projects/redux-debugger-vscode/src/middleware';
```

For a published package, use:

```ts
import { reduxDebuggerMiddleware } from 'redux-state-debugger/middleware';
```

Then update your store:

```ts
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { reduxDebuggerMiddleware } from '/Users/pradeep/Projects/redux-debugger-vscode/src/middleware';

export const store = configureStore({
  reducer: rootReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().concat(
      reduxDebuggerMiddleware({
        port: 8765,
        enabled: import.meta.env.DEV,
      })
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

If your app uses Create React App instead of Vite, use:

```ts
enabled: process.env.NODE_ENV === 'development'
```

## 3. Dispatch a real Redux action

Start your React app:

```bash
npm run dev
```

Click anything that dispatches a Redux action.

Expected result inside the Extension Development Host:

- `Action History` shows the action type.
- `Redux State Tree` shows the latest store state.
- `Redux Debugger Dashboard` shows each top-level store slice.
- Each action lists the slices and state paths it changed.
- The status bar changes from `Redux 0 actions` to `Redux 1 actions`, then keeps counting.

## 4. Track component re-renders

Wrap a component during development:

```tsx
import { withRerenderTracking } from '/Users/pradeep/Projects/redux-debugger-vscode/src/middleware';

function CounterPanel({ value, onIncrement }: Props) {
  return (
    <button onClick={onIncrement}>
      Count: {value}
    </button>
  );
}

export default withRerenderTracking(CounterPanel, 'CounterPanel', {
  port: 8765,
});
```

Expected result:

- `Re-render Detector` shows `CounterPanel`.
- It lists changed props when they are detected.
- If the render count passes your configured threshold, VS Code shows a warning.

## 5. Manual smoke test

If you want to test without a React app, send fake events:

```bash
curl -X POST http://localhost:8765/update \
  -H 'Content-Type: application/json' \
  -d '{"type":"ACTION","payload":{"type":"counter/incremented","payload":{"amount":1},"timestamp":1778963000000,"duration":3,"changedSlices":["counter"],"changedPaths":["counter.value"]}}'
```

```bash
curl -X POST http://localhost:8765/update \
  -H 'Content-Type: application/json' \
  -d '{"type":"STATE_UPDATE","payload":{"counter":{"value":1,"status":"idle"},"todos":[{"id":1,"text":"Test debugger","done":false}]}}'
```

```bash
curl -X POST http://localhost:8765/update \
  -H 'Content-Type: application/json' \
  -d '{"type":"RERENDER","payload":{"component":"CounterPanel","count":5,"lastSeen":1778963000000,"props":["value","onIncrement"]}}'
```

Expected result:

- `Action History` shows `counter/incremented`.
- `Redux State Tree` shows `counter` and `todos`.
- `Re-render Detector` shows `CounterPanel`.
- `Redux Debugger Dashboard` shows a `counter` slice, and the action points to `counter.value`.

## 6. Dashboard UI

Run:

```text
Redux Debugger: Open Dashboard
```

The dashboard is the primary replacement-style UI:

- Left column: all top-level Redux store slices.
- Middle column: selected slice inspector with every state path and raw JSON.
- Right column: action timeline showing which slices changed.
- Bottom-right area: render hotspots sorted by repeated renders.

When your app dispatches an action, the middleware compares previous state and next state. It sends:

- `changedSlices`: top-level reducers touched by the action.
- `changedPaths`: nested state paths changed by the action.
- `duration`: reducer processing time.
- `payload`: sanitized action payload.

That is how the dashboard points each action to the right slice and state path.

## 7. Common problems

### The browser shows JSON at `/update`

That is correct. Browser GET requests show server status. Redux events are POST requests.

### Nothing appears in VS Code

Check these in order:

1. You are looking at the Extension Development Host window, not the original VS Code window.
2. You ran `Redux Debugger: Start Monitoring`.
3. The app uses `port: 8765`.
4. The app is running in development mode.
5. Browser console has no CORS or network errors.
6. `http://localhost:8765/update` shows `ok: true`.

### Port already in use

Change this in VS Code settings:

```json
{
  "reduxDebugger.port": 8766
}
```

Then update the React app middleware:

```ts
reduxDebuggerMiddleware({ port: 8766 })
```

Restart the Extension Development Host after changing the port.

## 8. Production safety

Keep this enabled only in development. The middleware already defaults to development mode, and it redacts common sensitive keys like password, token, secret, authorization, and cookie.

Do not send production customer state to a local or hosted debugger.
