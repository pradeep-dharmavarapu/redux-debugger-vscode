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
}

interface RerenderTracker {
  [componentName: string]: {
    count: number;
    lastProps: Record<string, unknown>;
  };
}

const rerenderTracker: RerenderTracker = {};

async function postToExtension(port: number, type: string, payload: unknown) {
  try {
    await fetch(`http://localhost:${port}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    });
  } catch {
    // Extension not running — fail silently
  }
}

export function reduxDebuggerMiddleware(config: DebuggerConfig = {}) {
  const {
    port = 8765,
    enabled = process.env.NODE_ENV === 'development',
    trackRerenders = true,
  } = config;

  if (!enabled) {
    return () => (next: (action: unknown) => unknown) => (action: unknown) => next(action);
  }

  return (store: { getState: () => unknown }) =>
    (next: (action: unknown) => unknown) =>
    (action: { type: string; payload?: unknown }) => {
      const start = performance.now();
      const result = next(action);
      const duration = Math.round(performance.now() - start);

      // Send action to extension
      postToExtension(port, 'ACTION', {
        type: action.type,
        payload: action.payload,
        timestamp: Date.now(),
        duration,
      });

      // Send updated state
      postToExtension(port, 'STATE_UPDATE', store.getState());

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
  Component: React.ComponentType<P>,
  componentName: string,
  port = 8765
): React.ComponentType<P> {
  if (process.env.NODE_ENV !== 'development') return Component;

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
      postToExtension(port, 'RERENDER', {
        component: componentName,
        count: tracker.count,
        file: (new Error()).stack?.split('\n')[2]?.trim(),
        lastSeen: Date.now(),
        props: changedProps,
      });
    }

    // Reset counter after 1 second window
    setTimeout(() => { tracker.count = 0; }, 1000);

    return Component(props);
  };
}
