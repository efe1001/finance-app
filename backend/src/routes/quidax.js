const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const quidax = axios.create({
  baseURL: 'https://openapi.quidax.io/exchange-open-api/api/v1',
  headers: { Authorization: `Bearer ${process.env.QUIDAX_API_KEY}` },
});

const NGN_PER_USD = 1631;
const COINGECKO_IDS = { BTC: 'bitcoin', ETH: 'ethereum', USDT: 'tether' };

async function priceInNgn(asset) {
  const id = COINGECKO_IDS[asset];
  if (!id) return 0;
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: id, vs_currencies: 'usd' },
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    return (data[id]?.usd || 0) * NGN_PER_USD;
  } catch {
    return 0;
  }
}

async function getOrCreateQuidaxUser(user) {
  if (user.quidax_user_id) return user.quidax_user_id;

  const { data } = await quidax.post('/users', {
    email: user.email,
    first_name: user.name.split(' ')[0] || user.name,
    last_name: user.name.split(' ').slice(1).join(' ') || user.name,
  });
  const quidaxUserId = data.data.id;
  await pool.query('UPDATE users SET quidax_user_id = $1 WHERE id = $2', [quidaxUserId, user.id]);
  return quidaxUserId;
}

// Returns a per-user deposit address for an asset, generating it via Quidax if it
// doesn't exist yet. Address generation is async on Quidax's side, so a fresh
// request returns status "pending" until the wallet.address.generated webhook lands.
router.get('/deposit-address/:asset', requireAuth, async (req, res) => {
  const asset = req.params.asset.toLowerCase();

  const { rows: existing } = await pool.query(
    'SELECT * FROM quidax_addresses WHERE user_id = $1 AND asset = $2',
    [req.user.id, asset],
  );
  if (existing.length) {
    return res.json({ status: existing[0].status, address: existing[0].address });
  }

  try {
    const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const quidaxUserId = await getOrCreateQuidaxUser(userRows[0]);

    const { data } = await quidax.post(`/users/${quidaxUserId}/wallets/${asset}/addresses`);
    const wallet = data.data;

    await pool.query(
      `INSERT INTO quidax_addresses (user_id, asset, status, address, network, quidax_wallet_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, asset) DO UPDATE SET status = $3, address = $4, network = $5, quidax_wallet_id = $6`,
      [req.user.id, asset, wallet.address ? 'ready' : 'pending', wallet.address || null, wallet.network || null, wallet.id],
    );

    res.json({ status: wallet.address ? 'ready' : 'pending', address: wallet.address || null });
  } catch (err) {
    res.status(502).json({ error: 'Could not generate deposit address', detail: err.response?.data?.message || err.message });
  }
});

function verifySignature(req) {
  const secret = process.env.QUIDAX_WEBHOOK_SECRET;
  if (!secret) return false;

  const header = req.headers['quidax-signature'];
  if (!header) return false;

  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  if (!parts.t || !parts.s) return false;

  const payload = `${parts.t}.${req.rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.s, 'hex'));
  } catch {
    return false;
  }
}

router.post('/webhook', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'wallet.address.generated') {
    await pool.query(
      `UPDATE quidax_addresses SET status = 'ready', address = $1
       WHERE quidax_wallet_id = $2`,
      [data.address, data.id],
    );
    return res.json({ ok: true });
  }

  if (event === 'deposit.transaction.confirmation') {
    const confirmed = data.payment_transaction?.status === 'confirmed';
    if (!confirmed) return res.json({ ok: true, skipped: 'not yet confirmed' });

    const { rows: userRows } = await pool.query('SELECT id FROM users WHERE quidax_user_id = $1', [data.user.id]);
    const internalUser = userRows[0];
    if (!internalUser) return res.json({ ok: true, skipped: 'unknown user' });

    const asset = (data.currency || '').toUpperCase();
    const qty = Number(data.amount);
    const priceNgn = await priceInNgn(asset);
    const amountNgn = qty * priceNgn;

    await pool.query(
      `INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address, asset, qty, provider_ref)
       VALUES ($1, 'crypto', $2, $3, $4, 'Pending', $5, $6, $7, $8)
       ON CONFLICT (provider_ref) DO NOTHING`,
      [
        internalUser.id,
        `Sell ${asset}`,
        `Auto-detected via Quidax · tx ${data.txid || data.id}`,
        amountNgn,
        data.txid || null,
        asset,
        qty,
        `QDX-${data.id}`,
      ],
    );

    return res.json({ ok: true });
  }

  res.json({ ok: true, ignored: event });
});

module.exports = router;
