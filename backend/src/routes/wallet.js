const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Balance minus any debits already sitting in the approval queue, so a user can't
// stack multiple pending orders that together exceed what they actually have.
async function getAvailableBalance(userId) {
  const { rows: userRows } = await pool.query('SELECT wallet_balance_ngn FROM users WHERE id = $1', [userId]);
  const { rows: pendingRows } = await pool.query(
    "SELECT COALESCE(SUM(amount_ngn), 0) AS pending_debits FROM transactions WHERE user_id = $1 AND status = 'Pending' AND amount_ngn < 0",
    [userId],
  );
  return Number(userRows[0].wallet_balance_ngn) + Number(pendingRows[0].pending_debits);
}

// Receipt bytes are excluded from list queries (they're base64 and can be a few MB
// each) — callers get a hasReceipt flag and fetch the actual file separately.
const TXN_LIST_COLUMNS = `
  id, user_id, type, title, subtitle, amount_ngn, status, address, admin_note,
  asset, qty, provider_ref, created_at, (receipt_data IS NOT NULL) AS has_receipt
`;

// 5MB raw, base64-encoded (~1.37x), so cap the encoded string a bit above that.
const MAX_RECEIPT_BASE64_CHARS = 7_000_000;

router.get('/transactions', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;
  const { rows } = await pool.query(
    `SELECT ${TXN_LIST_COLUMNS} FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.user.id, limit, offset],
  );
  res.json(rows);
});

router.post('/transactions', requireAuth, async (req, res) => {
  const { type, title, subtitle, amountNgn, address, asset, qty, receiptData, receiptMime, receiptFilename } = req.body;
  if (!type || !title || amountNgn == null) {
    return res.status(400).json({ error: 'type, title and amountNgn are required' });
  }
  if (receiptData && receiptData.length > MAX_RECEIPT_BASE64_CHARS) {
    return res.status(400).json({ error: 'Receipt file is too large (max 5MB)' });
  }

  if (amountNgn < 0) {
    const available = await getAvailableBalance(req.user.id);
    if (available < Math.abs(amountNgn)) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO transactions
      (user_id, type, title, subtitle, amount_ngn, status, address, asset, qty, receipt_data, receipt_mime, receipt_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING ${TXN_LIST_COLUMNS}`,
    [
      req.user.id, type, title, subtitle || null, amountNgn, 'Pending', address || null, asset || null, qty || null,
      receiptData || null, receiptMime || null, receiptFilename || null,
    ],
  );
  res.status(201).json(rows[0]);
});

router.get('/platform-wallets', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT asset, address FROM platform_wallets ORDER BY asset');
  res.json(rows);
});

router.get('/holdings', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT asset, amount FROM holdings WHERE user_id = $1', [req.user.id]);
  res.json(rows);
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
  const { amountNgn, accountNumber, bankName, bankCode, accountName, narration } = req.body;
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

  const available = await getAvailableBalance(req.user.id);
  if (available < amountNgn) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }

  await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      req.user.id,
      'withdrawal',
      'Withdraw to Bank',
      narration || `${accountName ? accountName + ' · ' : ''}${bankName} · ${accountNumber}`,
      -Math.abs(amountNgn),
      'Pending',
      `${bankCode || ''}:${bankName}:${accountNumber}`,
    ],
  );
  res.status(201).json({ status: 'Pending', message: 'Withdrawal submitted — awaiting admin approval.' });
});

// The single bank account payouts go to (gift card sales, and a quick-fill for
// withdrawals) — kept on the user record, not per-transaction, so it's one
// place to manage and always reflects where the user currently wants paying.
router.get('/payout-account', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT payout_bank_code, payout_bank_name, payout_account_number, payout_account_name FROM users WHERE id = $1',
    [req.user.id],
  );
  const u = rows[0];
  if (!u || !u.payout_account_number) return res.json(null);
  res.json({
    bankCode: u.payout_bank_code,
    bankName: u.payout_bank_name,
    accountNumber: u.payout_account_number,
    accountName: u.payout_account_name,
  });
});

router.post('/payout-account', requireAuth, async (req, res) => {
  const { bankCode, bankName, accountNumber, accountName } = req.body;
  if (!bankName || !accountNumber || !accountName) {
    return res.status(400).json({ error: 'bankName, accountNumber and accountName are required' });
  }
  await pool.query(
    'UPDATE users SET payout_bank_code = $1, payout_bank_name = $2, payout_account_number = $3, payout_account_name = $4 WHERE id = $5',
    [bankCode || null, bankName, accountNumber, accountName, req.user.id],
  );
  res.json({ bankCode: bankCode || null, bankName, accountNumber, accountName });
});

router.get('/limits', requireAuth, async (req, res) => {
  const settingsMap = {};
  (await pool.query('SELECT key, value FROM settings')).rows.forEach(r => (settingsMap[r.key] = Number(r.value)));
  res.json(settingsMap);
});

module.exports = router;
