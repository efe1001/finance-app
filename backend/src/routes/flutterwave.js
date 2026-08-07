const express = require('express');
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../firebase');

const router = express.Router();

const flw = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
});

// Where the app is reachable — used for Flutterwave's post-payment redirect.
const BACKEND_URL = process.env.BACKEND_PUBLIC_URL || 'https://finance-app-backend-tzke.onrender.com';

router.post('/initiate', requireAuth, async (req, res) => {
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

  const { rows: userRows } = await pool.query('SELECT name, email FROM users WHERE id = $1', [req.user.id]);
  const user = userRows[0];
  const txRef = `FA-${req.user.id}-${Date.now()}`;

  try {
    const { data } = await flw.post('/payments', {
      tx_ref: txRef,
      amount: amountNgn,
      currency: 'NGN',
      redirect_url: `${BACKEND_URL}/api/flutterwave/callback`,
      customer: { email: user.email, name: user.name },
      customizations: { title: 'Finance App', description: 'Wallet funding' },
    });

    await pool.query(
      'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, provider_ref) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [req.user.id, 'deposit', 'Wallet Funding', 'Card / Bank Transfer via Flutterwave', amountNgn, 'Pending', txRef],
    );

    res.json({ paymentLink: data.data.link });
  } catch (err) {
    res.status(502).json({ error: 'Could not start payment', detail: err.response?.data?.message || err.message });
  }
});

// Flutterwave redirects the user's browser here after payment.
router.get('/callback', async (req, res) => {
  const { status, tx_ref, transaction_id } = req.query;

  res.set('Content-Type', 'text/html');

  if (status !== 'successful' || !transaction_id) {
    return res.send(htmlPage('Payment not completed', 'You can close this window and return to the app.'));
  }

  try {
    const { data } = await flw.get(`/transactions/${transaction_id}/verify`);
    const txn = data.data;

    if (txn.status !== 'successful' || txn.currency !== 'NGN') {
      return res.send(htmlPage('Payment verification failed', 'Please contact support if you were charged.'));
    }

    const client = await pool.connect();
    let pending;
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        "SELECT * FROM transactions WHERE provider_ref = $1 AND status = 'Pending' FOR UPDATE",
        [tx_ref],
      );
      pending = rows[0];
      if (!pending) {
        await client.query('ROLLBACK');
        return res.send(htmlPage('Already processed', 'This payment was already confirmed. You can close this window.'));
      }
      if (Number(txn.amount) < Number(pending.amount_ngn)) {
        await client.query('ROLLBACK');
        return res.send(htmlPage('Amount mismatch', 'Please contact support — the paid amount did not match.'));
      }

      await client.query("UPDATE transactions SET status = 'Successful' WHERE id = $1", [pending.id]);
      await client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2', [
        pending.amount_ngn,
        pending.user_id,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const { rows: userRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [pending.user_id]);
    sendPush(userRows[0]?.fcm_token, 'Wallet funded', `₦${Number(pending.amount_ngn).toLocaleString()} has been added to your wallet.`);

    res.send(htmlPage('Payment successful', 'Your wallet has been credited. You can close this window and return to the app.'));
  } catch (err) {
    res.send(htmlPage('Something went wrong', 'Please contact support if you were charged.'));
  }
});

router.get('/banks', requireAuth, async (req, res) => {
  try {
    const { data } = await flw.get('/banks/NG');
    res.json(data.data.map(b => ({ code: b.code, name: b.name })));
  } catch (err) {
    res.status(502).json({ error: 'Could not load bank list', detail: err.response?.data?.message || err.message });
  }
});

router.post('/resolve-account', requireAuth, async (req, res) => {
  const { accountNumber, bankCode } = req.body;
  if (!accountNumber || !bankCode) {
    return res.status(400).json({ error: 'accountNumber and bankCode are required' });
  }
  try {
    const { data } = await flw.post('/accounts/resolve', { account_number: accountNumber, account_bank: bankCode });
    res.json({ accountName: data.data.account_name, accountNumber: data.data.account_number });
  } catch (err) {
    res.status(502).json({ error: 'Could not resolve account', detail: err.response?.data?.message || err.message });
  }
});

function htmlPage(title, message) {
  return `<!doctype html><html><body style="font-family:sans-serif;text-align:center;padding:60px 20px;background:#0B0F17;color:#EDEFF3;">
    <h2>${title}</h2><p style="color:#929CB0;">${message}</p></body></html>`;
}

module.exports = router;
