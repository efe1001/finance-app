const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/transactions', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
    [req.user.id],
  );
  res.json(rows);
});

router.post('/transactions', requireAuth, async (req, res) => {
  const { type, title, subtitle, amountNgn, status } = req.body;
  if (!type || !title || amountNgn == null) {
    return res.status(400).json({ error: 'type, title and amountNgn are required' });
  }
  const finalStatus = status || 'Pending';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [req.user.id, type, title, subtitle || null, amountNgn, finalStatus],
    );
    if (finalStatus === 'Successful') {
      await client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2', [
        amountNgn,
        req.user.id,
      ]);
    }
    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.post('/deposit', requireAuth, async (req, res) => {
  const { amountNgn } = req.body;
  if (!amountNgn || amountNgn <= 0) {
    return res.status(400).json({ error: 'amountNgn must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status) VALUES ($1, $2, $3, $4, $5, $6)',
      [req.user.id, 'deposit', 'Wallet Funding', 'Card / Bank Transfer', amountNgn, 'Successful'],
    );
    const { rows } = await client.query(
      'UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2 RETURNING wallet_balance_ngn',
      [amountNgn, req.user.id],
    );
    await client.query('COMMIT');
    res.status(201).json({ walletBalanceNgn: Number(rows[0].wallet_balance_ngn) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

module.exports = router;
