const { addEvent } = require('./_store');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  if (!body.type || !['ACTION', 'STATE_UPDATE', 'RERENDER'].includes(body.type)) {
    res.status(400).json({ error: 'Invalid event type' });
    return;
  }

  const event = addEvent(body.sessionId, body.type, body.payload);
  res.status(200).json({ ok: true, eventId: event.id });
};
