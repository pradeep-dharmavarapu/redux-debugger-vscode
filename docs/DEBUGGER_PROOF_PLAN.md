# Redux State Debugger Proof Plan

This project should not claim to be broadly "better than Redux DevTools" until the claim is backed by real evidence. The stronger and more defensible claim is:

> Redux State Debugger is better for VS Code-native Redux debugging and React re-render investigation because it brings state, actions, render hotspots, setup guidance, and reports into the editor workflow.

## Automated Proof Already Covered

Run:

```bash
npm test
```

The current integration suite compiles the extension code and validates the debugger against real-world Redux-style scenarios:

- Health endpoint responds with service status and stats.
- Unsupported messages are rejected without crashing the server.
- Middleware captures action history and state updates from auth, cart, todos, search, and dashboard slices.
- Middleware captures the initial store state and slice names automatically before any app action is dispatched.
- Sensitive fields such as tokens and passwords are redacted before leaving the app.
- Changed slices and changed state paths are reported per action.
- High-volume bursts of 250 actions are ingested without dropped action/state events.
- Oversized action payloads are truncated before sending to the debugger.
- Re-render tracking reports repeated renders and changed props.

## Real-World Scenarios To Add Next

- VS Code Extension Host smoke test with `@vscode/test-electron`.
- A runnable React + Redux Toolkit app under `examples/real-redux-app`.
- Browser automation that starts the example app, dispatches actions through the UI, and verifies the VS Code server receives matching events.
- Port conflict test that verifies the user sees a useful recovery path.
- Export report test that verifies the JSON report contains actions, state slices, and re-render hotspots.
- Dashboard webview test that verifies state, actions, and re-renders render correctly.

## Competitive Positioning

| Workflow | Redux DevTools | Redux State Debugger |
| --- | --- | --- |
| Browser action history | Yes | Yes |
| State inspection | Yes | Yes |
| Time travel / replay | Yes | Not yet |
| VS Code sidebar workflow | No | Yes |
| Middleware setup copy command | No | Yes |
| React re-render hotspot detection | No | Yes |
| Source-file navigation for render issues | Limited | Yes, when file metadata is available |
| Exportable performance report | Limited | Yes |
| Editor-native debugging story | No | Yes |

## Evidence Needed Before Marketplace Launch

- CI runs `npm test` on every push.
- README includes screenshots or GIFs from a real app session.
- README includes exact benchmark numbers from the test suite.
- Marketplace page says "better for editor-native Redux and re-render debugging" rather than "better than Redux DevTools" without qualification.
- Extension handles missing debugger, invalid payloads, and port conflicts gracefully.

## Future Features That Would Strengthen The Claim

- Action search, filters, and pinned action types.
- State diff visualization per action.
- Selector performance tracking.
- Component render flame list sorted by worst offenders.
- Click-to-open source for re-rendering components.
- Session recording and replay inside VS Code.
- Import/export debug sessions for teammates.
- Optional Redux DevTools bridge so users can compare both tools side by side.
