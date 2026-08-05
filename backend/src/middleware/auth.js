const jwt = require('jsonwebtoken');
const { pool } = require('../db');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function requireAdmin(req, res, next) {
  const { rows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]?.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
