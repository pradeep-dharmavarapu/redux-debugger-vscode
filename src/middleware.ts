/**
 * Redux State Debugger — Browser Middleware
 * 
 * Add this middleware to your Redux store to connect to the VS Code extension.
 * 
 * Usage:
 *   import { reduxDebuggerMiddleware } from 'redux-state-debugger/middleware';
 *   
 *   const store = configureStore({
 *     reducer: rootReducer,
 *     middleware: (getDefaultMiddleware) =>
 *       getDefaultMiddleware().concat(reduxDebuggerMiddleware()),
 *   });
 */

interface DebuggerConfig {
  port?: number;
  enabled?: boolean;
  trackRerenders?: boolean;
  endpoint?: string;
  sessionId?: string;
  maxPayloadBytes?: number;
  redactKeys?: string[];
  updatePath?: string;
}

interface RerenderTracker {
  [componentName: string]: {
    count: number;
    lastProps: Record<string, unknown>;
  };
}

const rerenderTracker: RerenderTracker = {};
const DEFAULT_REDACT_KEYS = ['password', 'token', 'secret', 'authorization', 'cookie'];
const MAX_DIFF_PATHS = 200;

type ComponentType<P> = (props: P) => unknown;

function createUpdateUrl(config: DebuggerConfig) {
  if (!config.endpoint) return `http://localhost:${config.port ?? 8765}/update`;
  const endpoint = config.endpoint.replace(/\/$/, '');
  if (endpoint.endsWith('/update')) return endpoint;
  const updatePath = config.updatePath ?? '/api/update';
  return `${endpoint}${updatePath.startsWith('/') ? updatePath : `/${updatePath}`}`;
}

function sanitize(value: unknown, redactKeys: string[], seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 100).map(item => sanitize(item, redactKeys, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      const shouldRedact = redactKeys.some(redacted => key.toLowerCase().includes(redacted));
      return [key, shouldRedact ? '[Redacted]' : sanitize(nested, redactKeys, seen)];
    })
  );
}

function truncatePayload(payload: unknown, maxPayloadBytes: number) {
  const json = JSON.stringify(payload);
  if (json.length <= maxPayloadBytes) return payload;
  return {
    truncated: true,
    bytes: json.length,
    preview: json.slice(0, maxPayloadBytes),
  };
}

function getChangedPaths(previous: unknown, next: unknown, prefix = '', paths: string[] = []): string[] {
  if (paths.length >= MAX_DIFF_PATHS) return paths;
  if (Object.is(previous, next)) return paths;

  if (!isRecord(previous) || !isRecord(next)) {
    paths.push(prefix || 'root');
    return paths;
  }

  const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const key of keys) {
    if (paths.length >= MAX_DIFF_PATHS) break;
    const nextPath = prefix ? `${prefix}.${key}` : key;
    getChangedPaths(previous[key], next[key], nextPath, paths);
  }

  return paths;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function postToDebugger(updateUrl: string, type: string, payload: unknown, sessionId?: string) {
  try {
    await fetch(updateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload, sessionId }),
      keepalive: true,
    });
  } catch {
    // Debugger not running or unreachable. App behavior must never be affected.
  }
}

export function reduxDebuggerMiddleware(config: DebuggerConfig = {}) {
  const {
    enabled = process.env.NODE_ENV === 'development',
    maxPayloadBytes = 150_000,
    redactKeys = DEFAULT_REDACT_KEYS,
  } = config;
  const updateUrl = createUpdateUrl(config);

  if (!enabled) {
    return () => (next: (action: unknown) => unknown) => (action: unknown) => next(action);
  }

  return (store: { getState: () => unknown }) =>
    (next: (action: unknown) => unknown) =>
    (action: { type: string; payload?: unknown }) => {
      const previousState = store.getState();
      const start = performance.now();
      const result = next(action);
      const duration = Math.round(performance.now() - start);
      const nextState = store.getState();
      const changedPaths = getChangedPaths(previousState, nextState);
      const changedSlices = Array.from(new Set(
        changedPaths.map(path => path.split('.')[0]).filter(Boolean)
      ));
      const state = truncatePayload(
        sanitize(nextState, redactKeys),
        maxPayloadBytes
      );

      postToDebugger(updateUrl, 'ACTION', {
        type: action.type,
        payload: truncatePayload(sanitize(action.payload, redactKeys), maxPayloadBytes),
        timestamp: Date.now(),
        duration,
        changedSlices,
        changedPaths: changedPaths.slice(0, MAX_DIFF_PATHS),
      }, config.sessionId);

      postToDebugger(updateUrl, 'STATE_UPDATE', state, config.sessionId);

      return result;
    };
}

/**
 * Higher-order component to track re-renders.
 * Wrap your components with this in development to detect unnecessary re-renders.
 * 
 * Usage:
 *   import { withRerenderTracking } from 'redux-state-debugger/middleware';
 *   export default withRerenderTracking(MyComponent, 'MyComponent');
 */
export function withRerenderTracking<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  componentName: string,
  config: DebuggerConfig | number = {}
): ComponentType<P> {
  if (process.env.NODE_ENV !== 'development') return Component;
  const resolvedConfig = typeof config === 'number' ? { port: config } : config;
  const updateUrl = createUpdateUrl(resolvedConfig);

  return function TrackedComponent(props: P) {
    if (!rerenderTracker[componentName]) {
      rerenderTracker[componentName] = { count: 0, lastProps: {} };
    }

    const tracker = rerenderTracker[componentName];
    tracker.count++;

    // Detect which props changed
    const changedProps = Object.keys(props).filter(
      key => props[key] !== tracker.lastProps[key]
    );
    tracker.lastProps = { ...props };

    if (tracker.count > 1) {
      postToDebugger(updateUrl, 'RERENDER', {
        component: componentName,
        count: tracker.count,
        file: (new Error()).stack?.split('\n')[2]?.trim(),
        lastSeen: Date.now(),
        props: changedProps,
      }, resolvedConfig.sessionId);
    }

    // Reset counter after 1 second window
    setTimeout(() => { tracker.count = 0; }, 1000);

    return Component(props);
  };
}
