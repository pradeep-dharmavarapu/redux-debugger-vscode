const { getSession } = require('./_store');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const sessionId = `session-${Math.random().toString(36).slice(2, 10)}`;
  getSession(sessionId);
  res.status(200).json({ sessionId });
};
