const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendPush } = require('../firebase');

const router = express.Router();

// Any logged-in user can check the latest announcement - this is what powers
// the Home screen banner. Returns null once there's nothing to show, rather
// than an empty array, since the client only ever cares about "the one
// current thing" and its own id to compare against what's already dismissed.
router.get('/latest', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC LIMIT 1');
  res.json(rows[0] || null);
});

router.use(requireAuth, requireAdmin);

// Creating one both saves it (so it keeps showing as a Home banner for
// anyone who hasn't dismissed it yet, even if they missed the push) and
// pushes it immediately to every user with a saved device token - the two
// halves of "users will get it there and it'll still come as a push too."
router.post('/', async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });

  const { rows } = await pool.query(
    'INSERT INTO announcements (title, body, admin_id) VALUES ($1, $2, $3) RETURNING id, title, body, created_at',
    [title, body, req.user.id],
  );

  const { rows: users } = await pool.query("SELECT fcm_token FROM users WHERE fcm_token IS NOT NULL AND fcm_token <> ''");
  await Promise.all(users.map(u => sendPush(u.fcm_token, title, body)));

  res.status(201).json({ ...rows[0], recipients: users.length });
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.title, a.body, a.created_at, u.name AS admin_name
     FROM announcements a LEFT JOIN users u ON u.id = a.admin_id
     ORDER BY a.created_at DESC LIMIT 20`,
  );
  res.json(rows);
});

module.exports = router;
