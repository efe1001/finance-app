const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireAdmin);

// --- Transaction approvals ---

router.get('/transactions', async (req, res) => {
  const status = req.query.status || 'Pending';
  const { rows } = await pool.query(
    `SELECT t.*, u.name AS user_name, u.email AS user_email
     FROM transactions t JOIN users u ON u.id = t.user_id
     WHERE t.status = $1
     ORDER BY t.created_at ASC`,
    [status],
  );
  res.json(rows);
});

router.post('/transactions/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT * FROM transactions WHERE id = $1 FOR UPDATE', [req.params.id]);
    const txn = rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (txn.status !== 'Pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Transaction is already ${txn.status}` });
    }

    await client.query('UPDATE transactions SET status = $1 WHERE id = $2', ['Successful', txn.id]);
    await client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2', [
      txn.amount_ngn,
      txn.user_id,
    ]);
    await client.query('COMMIT');
    res.json({ status: 'Successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/transactions/:id/reject', async (req, res) => {
  const { note } = req.body;
  const { rows } = await pool.query(
    "UPDATE transactions SET status = 'Rejected', admin_note = $1 WHERE id = $2 AND status = 'Pending' RETURNING *",
    [note || null, req.params.id],
  );
  if (!rows.length) return res.status(400).json({ error: 'Transaction not found or already processed' });
  res.json({ status: 'Rejected' });
});

// --- User management ---

router.get('/users', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, wallet_balance_ngn, is_admin, created_at FROM users ORDER BY created_at DESC',
  );
  res.json(rows);
});

router.post('/users/:id/adjust-balance', async (req, res) => {
  const { amountNgn, note } = req.body;
  if (!amountNgn) return res.status(400).json({ error: 'amountNgn is required (positive to add, negative to reduce)' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, admin_note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.params.id, 'admin_adjustment', amountNgn >= 0 ? 'Admin Credit' : 'Admin Debit', 'Manual balance adjustment', amountNgn, 'Successful', note || null],
    );
    const { rows } = await client.query(
      'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2 RETURNING wallet_balance_ngn',
      [amountNgn, req.params.id],
    );
    await client.query('COMMIT');
    res.json({ walletBalanceNgn: Number(rows[0].wallet_balance_ngn) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// --- Analytics ---

router.get('/stats', async (req, res) => {
  const [{ rows: userStats }, { rows: txnStats }, { rows: pendingCount }] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS total_users, COALESCE(SUM(wallet_balance_ngn), 0) AS total_balance_ngn FROM users'),
    pool.query(
      `SELECT type, status, COUNT(*)::int AS count, COALESCE(SUM(amount_ngn), 0) AS total_ngn
       FROM transactions GROUP BY type, status ORDER BY type, status`,
    ),
    pool.query("SELECT COUNT(*)::int AS count FROM transactions WHERE status = 'Pending'"),
  ]);

  res.json({
    totalUsers: userStats[0].total_users,
    totalBalanceNgn: Number(userStats[0].total_balance_ngn),
    pendingApprovals: pendingCount[0].count,
    breakdown: txnStats.map(r => ({ ...r, total_ngn: Number(r.total_ngn) })),
  });
});

// --- Settings (deposit/withdrawal limits) ---

router.get('/settings', async (req, res) => {
  const { rows } = await pool.query('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => (settings[r.key] = r.value));
  res.json(settings);
});

router.put('/settings', async (req, res) => {
  const entries = Object.entries(req.body);
  for (const [key, value] of entries) {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, String(value)],
    );
  }
  res.json({ ok: true });
});

module.exports = router;
