const express = require('express');
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../firebase');

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

// Symbol -> CoinGecko id, matching the asset list the app trades elsewhere.
const SWAP_ASSET_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether', USDC: 'usd-coin',
  BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin',
};
// Kept as revenue on every swap, same reasoning as the bills service fee -
// taken out of the destination amount, never out of what leaves holdings.
const SWAP_SPREAD = 0.01;

// Crypto-to-crypto swap is purely an internal ledger move (holdings table
// only) using a live CoinGecko rate - unlike buy/sell, there's no external
// payment gateway or on-chain transfer involved on either side, so it
// settles immediately instead of sitting in the admin approval queue.
router.post('/swap', requireAuth, async (req, res) => {
  const { fromAsset, toAsset, fromQty } = req.body;
  if (!fromAsset || !toAsset || !fromQty || fromQty <= 0) {
    return res.status(400).json({ error: 'fromAsset, toAsset and a positive fromQty are required' });
  }
  if (fromAsset === toAsset) return res.status(400).json({ error: 'Choose two different assets' });
  const fromId = SWAP_ASSET_IDS[fromAsset];
  const toId = SWAP_ASSET_IDS[toAsset];
  if (!fromId || !toId) return res.status(400).json({ error: 'Unsupported asset' });

  let fromPrice, toPrice;
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: `${fromId},${toId}`, vs_currencies: 'usd' },
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    fromPrice = data[fromId]?.usd;
    toPrice = data[toId]?.usd;
  } catch (err) {
    return res.status(502).json({ error: 'Could not fetch live prices, try again' });
  }
  if (!fromPrice || !toPrice) return res.status(502).json({ error: 'Price unavailable for one of these assets right now' });

  const toQty = ((fromQty * fromPrice) / toPrice) * (1 - SWAP_SPREAD);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: heldRows } = await client.query(
      'SELECT amount FROM holdings WHERE user_id = $1 AND asset = $2 FOR UPDATE',
      [req.user.id, fromAsset],
    );
    const heldQty = Number(heldRows[0]?.amount || 0);
    if (heldQty < fromQty) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `You only hold ${heldQty} ${fromAsset}` });
    }

    await client.query(
      `INSERT INTO holdings (user_id, asset, amount) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, asset) DO UPDATE SET amount = holdings.amount - $3`,
      [req.user.id, fromAsset, fromQty],
    );
    await client.query(
      `INSERT INTO holdings (user_id, asset, amount) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, asset) DO UPDATE SET amount = holdings.amount + $3`,
      [req.user.id, toAsset, toQty],
    );
    // amount_ngn stays 0 - a swap moves value between two holdings, it never
    // touches wallet_balance_ngn or counts as NGN spent/received in Reports.
    await client.query(
      `INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, asset, qty)
       VALUES ($1, 'swap', $2, $3, 0, 'Successful', $4, $5)`,
      [req.user.id, `Swap ${fromAsset} → ${toAsset}`, `${fromQty} ${fromAsset} → ${toQty.toFixed(8)} ${toAsset}`, fromAsset, fromQty],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows: userRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [req.user.id]);
  sendPush(userRows[0]?.fcm_token, 'Swap complete', `${fromQty} ${fromAsset} swapped for ${toQty.toFixed(6)} ${toAsset}.`);

  res.status(201).json({ status: 'Successful', toQty, message: `Swapped for ${toQty.toFixed(6)} ${toAsset}.` });
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

  // A flaky connection or an impatient double-tap can submit the same manual
  // transfer claim twice - each one looks like a legitimate distinct request
  // to an admin reviewing the queue, so the guard has to be here rather than
  // relying on the approval step (which is already correctly idempotent
  // per-row, that was never the actual gap).
  const { rows: dupeRows } = await pool.query(
    `SELECT id FROM transactions
     WHERE user_id = $1 AND type = 'deposit' AND status = 'Pending' AND amount_ngn = $2
       AND created_at > NOW() - INTERVAL '10 minutes'`,
    [req.user.id, amountNgn],
  );
  if (dupeRows.length) {
    return res.status(409).json({ error: 'You already have a matching deposit awaiting approval — no need to submit it again.' });
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
