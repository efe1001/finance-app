const express = require('express');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// One-time bootstrap to promote the first admin — protected by the server's own
// JWT secret so only someone with deploy access can call it. Remove once no longer needed.
router.post('/bootstrap', async (req, res) => {
  const { email, secret } = req.body;
  if (secret !== process.env.JWT_SECRET) return res.status(403).json({ error: 'Invalid secret' });
  const { rows } = await pool.query('UPDATE users SET is_admin = TRUE WHERE email = $1 RETURNING id, name, email', [email]);
  if (!rows.length) return res.status(404).json({ error: 'No user with that email' });
  res.json({ promoted: rows[0] });
});

// Receipt files are opened via Linking.openURL from the app, which can't attach an
// Authorization header — so this one route takes the token as a query param instead
// and verifies it manually, ahead of the header-based requireAuth used everywhere else.
router.get('/transactions/:id/receipt-file', async (req, res) => {
  try {
    const payload = jwt.verify(req.query.token || '', process.env.JWT_SECRET);
    const { rows: adminRows } = await pool.query('SELECT is_admin FROM users WHERE id = $1', [payload.id]);
    if (!adminRows[0]?.is_admin) return res.status(403).send('Admin access required');
  } catch {
    return res.status(401).send('Invalid or expired link');
  }

  const { rows } = await pool.query(
    'SELECT receipt_data, receipt_mime, receipt_filename FROM transactions WHERE id = $1',
    [req.params.id],
  );
  const txn = rows[0];
  if (!txn?.receipt_data) return res.status(404).send('No receipt attached');

  res.set('Content-Type', txn.receipt_mime || 'application/octet-stream');
  res.set('Content-Disposition', `inline; filename="${txn.receipt_filename || 'receipt'}"`);
  res.send(Buffer.from(txn.receipt_data, 'base64'));
});

router.use(requireAuth, requireAdmin);

// --- Transaction approvals ---

router.get('/transactions', async (req, res) => {
  const status = req.query.status || 'Pending';
  const { rows } = await pool.query(
    `SELECT t.id, t.user_id, t.type, t.title, t.subtitle, t.amount_ngn, t.status, t.address, t.admin_note,
            t.asset, t.qty, t.provider_ref, t.created_at, (t.receipt_data IS NOT NULL) AS has_receipt,
            u.name AS user_name, u.email AS user_email
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

    if (txn.type === 'crypto' && txn.asset && txn.qty != null) {
      // Buying crypto: NGN goes down (negative amount_ngn), asset holding goes up.
      // Selling crypto: NGN goes up, asset holding goes down.
      const holdingDelta = txn.amount_ngn < 0 ? Number(txn.qty) : -Number(txn.qty);
      await client.query(
        `INSERT INTO holdings (user_id, asset, amount) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, asset) DO UPDATE SET amount = holdings.amount + $3`,
        [txn.user_id, txn.asset, holdingDelta],
      );
    }

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

// --- Gift card rates ---

router.get('/giftcard-rates', async (req, res) => {
  const { rows } = await pool.query('SELECT brand, rate_per_dollar FROM gift_card_rates ORDER BY brand');
  res.json(rows.map(r => ({ brand: r.brand, ratePerDollar: Number(r.rate_per_dollar) })));
});

router.put('/giftcard-rates/:brand', async (req, res) => {
  const { ratePerDollar } = req.body;
  if (!ratePerDollar || ratePerDollar <= 0) return res.status(400).json({ error: 'ratePerDollar must be positive' });
  const { rows } = await pool.query(
    'INSERT INTO gift_card_rates (brand, rate_per_dollar) VALUES ($1, $2) ON CONFLICT (brand) DO UPDATE SET rate_per_dollar = $2 RETURNING *',
    [req.params.brand, ratePerDollar],
  );
  res.json({ brand: rows[0].brand, ratePerDollar: Number(rows[0].rate_per_dollar) });
});

router.delete('/giftcard-rates/:brand', async (req, res) => {
  await pool.query('DELETE FROM gift_card_rates WHERE brand = $1', [req.params.brand]);
  res.json({ ok: true });
});

// --- Platform wallet addresses (users send crypto here when selling) ---

router.get('/wallets', async (req, res) => {
  const { rows } = await pool.query('SELECT asset, address, updated_at FROM platform_wallets ORDER BY asset');
  res.json(rows);
});

router.put('/wallets/:asset', async (req, res) => {
  const { address } = req.body;
  if (address == null) return res.status(400).json({ error: 'address is required' });
  const { rows } = await pool.query(
    'UPDATE platform_wallets SET address = $1, updated_at = NOW() WHERE asset = $2 RETURNING *',
    [address, req.params.asset.toUpperCase()],
  );
  if (!rows.length) return res.status(404).json({ error: 'Unknown asset' });
  res.json(rows[0]);
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
