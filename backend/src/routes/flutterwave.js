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

// Shared by the redirect callback, the webhook, and the manual recheck
// endpoint - all three are really just "find out what Flutterwave actually
// thinks happened, and act on it exactly once." Bank transfers in particular
// often aren't confirmed yet at the moment the browser redirects back, so
// trusting only the redirect's own query params (as the old code did) meant
// a transfer that settled seconds later than the mobile UI it looks like
// it's watching would show a wallet that never updates - even though
// Flutterwave has already accepted the money. Re-verifying by reference
// against Flutterwave's own records, from any of the three entry points, is
// what actually closes that gap.
async function resolveDeposit(txRef) {
  if (!txRef) return { outcome: 'error', message: 'No reference supplied' };

  let txn;
  try {
    const { data } = await flw.get(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`);
    txn = data.data;
  } catch (err) {
    return { outcome: 'error', message: err.response?.data?.message || err.message };
  }

  if (!txn) return { outcome: 'error', message: 'Flutterwave has no record of this payment' };

  if (txn.status === 'pending') return { outcome: 'pending' };

  if (txn.status !== 'successful' || txn.currency !== 'NGN') {
    const { rows } = await pool.query(
      "UPDATE transactions SET status = 'Rejected', admin_note = $1 WHERE provider_ref = $2 AND status = 'Pending' RETURNING id, user_id, amount_ngn",
      [`Flutterwave: ${txn.status}`, txRef],
    );
    if (rows[0]) {
      const { rows: u } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [rows[0].user_id]);
      sendPush(u[0]?.fcm_token, 'Deposit failed', `Your ₦${Number(rows[0].amount_ngn).toLocaleString()} deposit didn't go through.`);
    }
    return { outcome: 'failed' };
  }

  const client = await pool.connect();
  let pending;
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT * FROM transactions WHERE provider_ref = $1 AND status = 'Pending' FOR UPDATE",
      [txRef],
    );
    pending = rows[0];
    if (!pending) {
      await client.query('ROLLBACK');
      return { outcome: 'already_processed' };
    }
    if (Number(txn.amount) < Number(pending.amount_ngn)) {
      await client.query("UPDATE transactions SET status = 'Rejected', admin_note = 'Amount mismatch' WHERE id = $1", [pending.id]);
      await client.query('COMMIT');
      return { outcome: 'amount_mismatch' };
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

  return { outcome: 'success', pending };
}

// Flutterwave redirects the user's browser here after payment.
router.get('/callback', async (req, res) => {
  const { tx_ref } = req.query;
  res.set('Content-Type', 'text/html');

  let result;
  try {
    result = await resolveDeposit(tx_ref);
  } catch (err) {
    return res.send(htmlPage('Something went wrong', 'Please contact support if you were charged.'));
  }

  const pages = {
    success: htmlPage('Payment successful', 'Your wallet has been credited. You can close this window and return to the app.'),
    pending: htmlPage('Payment processing', "We're still confirming this with your bank - it usually takes a few minutes. Your wallet will update automatically and you'll get a notification, no need to retry."),
    failed: htmlPage('Payment failed', 'This payment was not successful. You can close this window and return to the app.'),
    amount_mismatch: htmlPage('Amount mismatch', 'Please contact support — the paid amount did not match.'),
    already_processed: htmlPage('Already processed', 'This payment was already confirmed. You can close this window.'),
    error: htmlPage('Something went wrong', 'Please contact support if you were charged.'),
  };
  res.send(pages[result.outcome] || pages.error);
});

// Flutterwave calls this server-to-server when a transaction's status
// changes - the only way to catch a bank transfer that confirms after the
// user has already closed the browser tab from /callback. Requires
// FLUTTERWAVE_WEBHOOK_SECRET to be set to the same value configured in the
// Flutterwave dashboard's webhook settings; without it this safely no-ops
// rather than trusting unverified input that could credit arbitrary wallets.
router.post('/webhook', express.json(), async (req, res) => {
  const expectedSecret = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.warn('Flutterwave webhook received but FLUTTERWAVE_WEBHOOK_SECRET is not configured - ignoring.');
    return res.status(501).send('Webhook not configured');
  }
  if (req.headers['verif-hash'] !== expectedSecret) {
    return res.status(401).send('Invalid signature');
  }

  try {
    // Deposits (charge.completed) and payouts (transfer.completed) both land
    // on this one webhook URL - branch on event type so a transfer
    // confirmation doesn't get misread as a deposit reference.
    if (req.body?.event === 'transfer.completed') {
      await resolveWithdrawal(req.body?.data?.reference);
    } else {
      const txRef = req.body?.data?.tx_ref || req.body?.txRef;
      await resolveDeposit(txRef);
    }
  } catch (err) {
    console.error('Webhook processing failed:', err.message);
  }
  res.status(200).send('OK'); // ack fast regardless - Flutterwave retries on non-2xx
});

// Lets the app (or support) manually re-check a deposit that's still showing
// Pending, instead of waiting on the webhook. Safe to call repeatedly -
// resolveDeposit only ever acts on a transaction still in Pending state, and
// only for the caller's own transaction.
router.get('/recheck/:txRef', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT user_id FROM transactions WHERE provider_ref = $1', [req.params.txRef]);
  if (!rows.length) return res.status(404).json({ error: 'No such transaction' });
  if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your transaction' });

  try {
    const result = await resolveDeposit(req.params.txRef);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Sends a real payout via Flutterwave's Transfers API - this is what makes a
// withdrawal actually pay the user automatically instead of an admin sending
// it by hand. A successful call here only means Flutterwave accepted the
// transfer for processing (status "NEW"); it isn't necessarily complete yet,
// which is why the caller stores the reference and waits on the webhook (or
// a manual recheck) rather than treating this response as final.
async function initiateTransfer({ accountBank, accountNumber, amount, narration, reference }) {
  const { data } = await flw.post('/transfers', {
    account_bank: accountBank,
    account_number: accountNumber,
    amount,
    narration,
    currency: 'NGN',
    reference,
  });
  return data.data;
}

// Mirrors resolveDeposit's job but for money leaving instead of arriving -
// the transaction sits 'Processing' (balance already deducted at submission)
// until Flutterwave confirms one way or the other. A failure here means the
// bank transfer itself didn't go through, so the deducted balance is
// refunded - nothing was actually sent.
async function resolveWithdrawal(reference) {
  if (!reference) return { outcome: 'error', message: 'No reference supplied' };

  let transfer;
  try {
    const { data } = await flw.get(`/transfers?reference=${encodeURIComponent(reference)}`);
    transfer = data.data?.[0];
  } catch (err) {
    return { outcome: 'error', message: err.response?.data?.message || err.message };
  }
  if (!transfer) return { outcome: 'error', message: 'Flutterwave has no record of this transfer' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      "SELECT * FROM transactions WHERE provider_ref = $1 AND status = 'Processing' FOR UPDATE",
      [reference],
    );
    const txn = rows[0];
    if (!txn) {
      await client.query('ROLLBACK');
      return { outcome: 'already_processed' };
    }

    if (transfer.status === 'SUCCESSFUL') {
      await client.query("UPDATE transactions SET status = 'Successful' WHERE id = $1", [txn.id]);
      await client.query('COMMIT');
      const { rows: u } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [txn.user_id]);
      sendPush(u[0]?.fcm_token, 'Withdrawal sent', `₦${Math.abs(txn.amount_ngn).toLocaleString()} has been sent to your bank account.`);
      return { outcome: 'success' };
    }
    if (transfer.status === 'FAILED') {
      await client.query("UPDATE transactions SET status = 'Rejected', admin_note = 'Transfer failed at bank' WHERE id = $1", [txn.id]);
      await client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2', [
        Math.abs(txn.amount_ngn),
        txn.user_id,
      ]);
      await client.query('COMMIT');
      const { rows: u } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [txn.user_id]);
      sendPush(u[0]?.fcm_token, 'Withdrawal failed', `Your ₦${Math.abs(txn.amount_ngn).toLocaleString()} withdrawal failed and has been refunded to your wallet.`);
      return { outcome: 'failed' };
    }
    await client.query('ROLLBACK');
    return { outcome: 'pending' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Lets the app (or support) manually re-check a withdrawal still showing
// Processing, instead of waiting on the webhook. Safe to call repeatedly -
// resolveWithdrawal only ever acts on a transaction still Processing, and
// only for the caller's own transaction.
router.get('/recheck-transfer/:reference', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT user_id FROM transactions WHERE provider_ref = $1', [req.params.reference]);
  if (!rows.length) return res.status(404).json({ error: 'No such transaction' });
  if (rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not your transaction' });

  try {
    const result = await resolveWithdrawal(req.params.reference);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
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

module.exports = { router, initiateTransfer };
