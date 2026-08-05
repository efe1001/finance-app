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
  const { type, title, subtitle, amountNgn, address } = req.body;
  if (!type || !title || amountNgn == null) {
    return res.status(400).json({ error: 'type, title and amountNgn are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [req.user.id, type, title, subtitle || null, amountNgn, 'Pending', address || null],
  );
  res.status(201).json(rows[0]);
});

router.post('/deposit', requireAuth, async (req, res) => {
  const { amountNgn } = req.body;
  if (!amountNgn || amountNgn <= 0) {
    return res.status(400).json({ error: 'amountNgn must be a positive number' });
  }

  const settingsMap = {};
  (await pool.query('SELECT key, value FROM settings')).rows.forEach(r => (settingsMap[r.key] = Number(r.value)));

  if (amountNgn < settingsMap.min_deposit_ngn || amountNgn > settingsMap.max_deposit_ngn) {
    return res.status(400).json({
      error: `Deposit must be between ₦${settingsMap.min_deposit_ngn.toLocaleString()} and ₦${settingsMap.max_deposit_ngn.toLocaleString()}`,
    });
  }

  await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status) VALUES ($1, $2, $3, $4, $5, $6)',
    [req.user.id, 'deposit', 'Wallet Funding', 'Card / Bank Transfer · awaiting approval', amountNgn, 'Pending'],
  );
  res.status(201).json({ status: 'Pending', message: 'Deposit submitted — awaiting admin approval.' });
});

router.post('/withdraw', requireAuth, async (req, res) => {
  const { amountNgn, accountNumber, bankName, narration } = req.body;
  if (!amountNgn || amountNgn <= 0 || !accountNumber || !bankName) {
    return res.status(400).json({ error: 'amountNgn, accountNumber and bankName are required' });
  }

  const settingsMap = {};
  (await pool.query('SELECT key, value FROM settings')).rows.forEach(r => (settingsMap[r.key] = Number(r.value)));

  if (amountNgn < settingsMap.min_withdrawal_ngn || amountNgn > settingsMap.max_withdrawal_ngn) {
    return res.status(400).json({
      error: `Withdrawal must be between ₦${settingsMap.min_withdrawal_ngn.toLocaleString()} and ₦${settingsMap.max_withdrawal_ngn.toLocaleString()}`,
    });
  }

  const { rows: userRows } = await pool.query('SELECT wallet_balance_ngn FROM users WHERE id = $1', [req.user.id]);
  if (Number(userRows[0].wallet_balance_ngn) < amountNgn) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      req.user.id,
      'withdrawal',
      'Withdraw to Bank',
      narration || `${bankName} · ${accountNumber}`,
      -Math.abs(amountNgn),
      'Pending',
      `${bankName}:${accountNumber}`,
    ],
  );
  res.status(201).json({ status: 'Pending', message: 'Withdrawal submitted — awaiting admin approval.' });
});

router.get('/limits', requireAuth, async (req, res) => {
  const settingsMap = {};
  (await pool.query('SELECT key, value FROM settings')).rows.forEach(r => (settingsMap[r.key] = Number(r.value)));
  res.json(settingsMap);
});

module.exports = router;
