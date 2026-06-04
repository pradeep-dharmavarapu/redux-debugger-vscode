const assert = require('node:assert');
const http = require('node:http');
const { setTimeout: delay } = require('node:timers/promises');

process.env.NODE_ENV = 'development';

const { WebSocketServer } = require('../out/server/WebSocketServer');
const {
  reduxDebuggerMiddleware,
  withRerenderTracking,
} = require('../out/middleware');
const {
  createRealWorldStore,
  dispatchRealWorldScenario,
  dispatchBurstScenario,
} = require('./scenarios/realWorldReduxScenario');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({
      method,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname,
      headers: payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          }
        : undefined,
    }, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let json;
        try {
          json = raw ? JSON.parse(raw) : undefined;
        } catch {
          json = raw;
        }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function waitFor(assertion, timeoutMs = 3000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await delay(25);
    }
  }
  throw lastError;
}

function createHarness() {
  const events = {
    actions: [],
    states: [],
    rerenders: [],
    errors: [],
  };
  const server = new WebSocketServer(0);
  server.onAction(action => events.actions.push(action));
  server.onStateUpdate(state => events.states.push(state));
  server.onRerender(rerender => events.rerenders.push(rerender));
  server.onError(error => events.errors.push(error));

  return {
    events,
    server,
    async ready() {
      await waitFor(() => assert.equal(server.isListening(), true));
      return `http://localhost:${server.getPort()}/update`;
    },
    close() {
      server.close();
    },
  };
}

test('health endpoint exposes service status and stats', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const healthUrl = updateUrl.replace('/update', '/health');
    const response = await request('GET', healthUrl);

    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.service, 'Redux State Debugger');
    assert.equal(response.body.stats.actions, 0);
  } finally {
    harness.close();
  }
});

test('server rejects invalid and unsupported messages without crashing', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const unsupported = await request('POST', updateUrl, { type: 'NOT_REAL', payload: {} });

    assert.equal(unsupported.status, 400);
    assert.equal(unsupported.body.ok, false);
    assert.equal(harness.server.getStats().invalidMessages, 1);
    assert.equal(harness.server.getStats().actions, 0);
  } finally {
    harness.close();
  }
});

test('middleware captures real-world Redux actions, sanitized state, changed slices, and changed paths', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const store = createRealWorldStore([
      reduxDebuggerMiddleware({
        endpoint: updateUrl,
        updatePath: '',
        redactKeys: ['token', 'password'],
      }),
    ]);

    dispatchRealWorldScenario(store);

    await waitFor(() => {
      assert.equal(harness.events.actions.length, 8);
      assert.equal(harness.events.states.length, 8);
    });

    const actionTypes = harness.events.actions.map(action => action.type);
    assert.deepEqual(actionTypes, [
      'auth/loginFulfilled',
      'cart/itemAdded',
      'cart/quantityChanged',
      'todos/todoAdded',
      'todos/todoCompleted',
      'search/queryChanged',
      'search/resultsFulfilled',
      'dashboard/widgetsLoaded',
    ]);

    const loginAction = harness.events.actions[0];
    assert.equal(loginAction.payload.token, '[Redacted]');
    assert.equal(loginAction.payload.password, '[Redacted]');
    assert.deepEqual(loginAction.changedSlices, ['auth']);
    assert.ok(loginAction.changedPaths.includes('auth.user'));

    const finalState = harness.events.states.at(-1);
    assert.equal(finalState.auth.token, '[Redacted]');
    assert.equal(finalState.cart.items[0].sku, 'SKU-REDUX-HOODIE');
    assert.equal(finalState.dashboard.widgets.length, 6);

    const stats = harness.server.getStats();
    assert.equal(stats.actions, 8);
    assert.equal(stats.stateUpdates, 8);
    assert.equal(stats.invalidMessages, 0);
  } finally {
    harness.close();
  }
});

test('middleware handles high-volume action bursts without dropped events', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const store = createRealWorldStore([
      reduxDebuggerMiddleware({ endpoint: updateUrl, updatePath: '' }),
    ]);

    dispatchBurstScenario(store, 250);

    await waitFor(() => {
      assert.equal(harness.events.actions.length, 250);
      assert.equal(harness.events.states.length, 250);
    }, 10000);

    assert.equal(harness.events.actions[0].type, 'perf/tick');
    assert.equal(harness.events.actions.at(-1).payload.index, 249);
    assert.equal(harness.events.states.at(-1).performance.tick, 250);
  } finally {
    harness.close();
  }
});

test('middleware truncates oversized payloads before sending to the debugger', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const store = createRealWorldStore([
      reduxDebuggerMiddleware({
        endpoint: updateUrl,
        updatePath: '',
        maxPayloadBytes: 500,
      }),
    ]);

    store.dispatch({
      type: 'dashboard/widgetsLoaded',
      payload: Array.from({ length: 80 }, (_, index) => ({
        id: `widget-${index}`,
        label: `Revenue widget ${index}`,
        values: Array.from({ length: 20 }, (_value, valueIndex) => valueIndex * index),
      })),
    });

    await waitFor(() => assert.equal(harness.events.actions.length, 1));

    assert.equal(harness.events.actions[0].payload.truncated, true);
    assert.ok(harness.events.actions[0].payload.bytes > 500);
    assert.ok(harness.events.actions[0].payload.preview.length <= 500);
  } finally {
    harness.close();
  }
});

test('rerender tracker reports repeated component renders and changed props', async () => {
  const harness = createHarness();
  try {
    const updateUrl = await harness.ready();
    const RenderHotspot = withRerenderTracking(
      props => `rendered:${props.total}`,
      'CartSummaryPanel',
      { endpoint: updateUrl, updatePath: '' }
    );

    RenderHotspot({ total: 120, currency: 'USD' });
    RenderHotspot({ total: 120, currency: 'USD' });
    RenderHotspot({ total: 125, currency: 'USD' });
    RenderHotspot({ total: 125, currency: 'USD' });

    await waitFor(() => assert.equal(harness.events.rerenders.length, 3));

    assert.equal(harness.events.rerenders.at(-1).component, 'CartSummaryPanel');
    assert.equal(harness.events.rerenders.at(-1).count, 4);
    assert.deepEqual(harness.events.rerenders[1].props, ['total']);
    assert.equal(harness.server.getStats().rerenders, 3);
  } finally {
    harness.close();
  }
});

(async () => {
  let failures = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✓ ${name}`);
    } catch (error) {
      failures++;
      console.error(`✗ ${name}`);
      console.error(error);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`\n${failures}/${tests.length} tests failed`);
    return;
  }

  console.log(`\n${tests.length} real-world debugger tests passed`);
})();
