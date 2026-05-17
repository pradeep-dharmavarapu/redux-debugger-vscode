const { getEvents } = require('./_store');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sessionId = req.query.session || req.query.sessionId || 'default';
  const after = Number(req.query.after || 0);
  res.status(200).json(getEvents(sessionId, Number.isFinite(after) ? after : 0));
};
