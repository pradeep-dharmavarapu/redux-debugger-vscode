const globalStore = globalThis.__REDUX_DEBUGGER_STORE__ ?? {
  sessions: new Map(),
};

globalThis.__REDUX_DEBUGGER_STORE__ = globalStore;

const MAX_EVENTS = 500;
const SESSION_TTL_MS = 1000 * 60 * 60 * 4;

function cleanup() {
  const now = Date.now();
  for (const [sessionId, session] of globalStore.sessions.entries()) {
    if (now - session.updatedAt > SESSION_TTL_MS) {
      globalStore.sessions.delete(sessionId);
    }
  }
}

function getSession(sessionId) {
  cleanup();
  const id = sessionId || 'default';
  if (!globalStore.sessions.has(id)) {
    globalStore.sessions.set(id, {
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextId: 1,
      state: {},
      actions: [],
      rerenders: [],
      events: [],
    });
  }
  return globalStore.sessions.get(id);
}

function addEvent(sessionId, type, payload) {
  const session = getSession(sessionId);
  const event = {
    id: session.nextId++,
    type,
    payload,
    timestamp: Date.now(),
  };

  session.updatedAt = Date.now();
  session.events.push(event);
  if (session.events.length > MAX_EVENTS) {
    session.events = session.events.slice(-MAX_EVENTS);
  }

  if (type === 'STATE_UPDATE') {
    session.state = payload;
  }

  if (type === 'ACTION') {
    session.actions.unshift(payload);
    session.actions = session.actions.slice(0, MAX_EVENTS);
  }

  if (type === 'RERENDER') {
    const existing = session.rerenders.find(item => item.component === payload.component);
    if (existing) {
      existing.count += payload.count;
      existing.lastSeen = payload.lastSeen;
      existing.props = payload.props;
      existing.file = payload.file || existing.file;
    } else {
      session.rerenders.push({ ...payload });
    }
    session.rerenders.sort((a, b) => b.count - a.count);
  }

  return event;
}

function getEvents(sessionId, after = 0) {
  const session = getSession(sessionId);
  return {
    sessionId: session.id,
    state: session.state,
    actions: session.actions,
    rerenders: session.rerenders,
    events: session.events.filter(event => event.id > after),
    updatedAt: session.updatedAt,
  };
}

function clearSession(sessionId) {
  const session = getSession(sessionId);
  session.updatedAt = Date.now();
  session.state = {};
  session.actions = [];
  session.rerenders = [];
  session.events = [];
  session.nextId = 1;
  return session;
}

module.exports = {
  addEvent,
  clearSession,
  getEvents,
  getSession,
};
