const express = require('express');
const { pool } = require('./../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Same fixed rate the rest of the app uses to pivot between NGN and USD
// (CurrencyContext.tsx on the client) — kept in sync manually since there's
// no live FX feed wired in yet.
const NGN_PER_USD = 1631;

const MAX_IMAGE_BASE64_CHARS = 7_000_000; // ~5MB raw, base64-encoded

router.get('/rates', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, brand, min_usd, max_usd, percentage FROM gift_card_tiers ORDER BY brand, min_usd',
  );
  const byBrand = {};
  rows.forEach(r => {
    if (!byBrand[r.brand]) byBrand[r.brand] = { brand: r.brand, tiers: [] };
    byBrand[r.brand].tiers.push({
      id: r.id,
      minUsd: Number(r.min_usd),
      maxUsd: r.max_usd == null ? null : Number(r.max_usd),
      percentage: Number(r.percentage),
    });
  });
  res.json(Object.values(byBrand));
});

// Submits a card for manual review — no automatic payout. An admin confirms
// the code is valid and unredeemed before the wallet is credited. The user
// proves the code either by typing it or attaching a photo of the card for
// an admin to read and copy themselves.
router.post('/submit', requireAuth, async (req, res) => {
  const { brand, faceValueUsd, code, receiptData, receiptMime, receiptFilename } = req.body;
  if (!brand || !faceValueUsd) {
    return res.status(400).json({ error: 'brand and faceValueUsd are required' });
  }
  if (!code && !receiptData) {
    return res.status(400).json({ error: 'Enter the card code or attach a photo of it' });
  }
  if (receiptData && receiptData.length > MAX_IMAGE_BASE64_CHARS) {
    return res.status(400).json({ error: 'Photo is too large (max 5MB)' });
  }

  const { rows: userRows } = await pool.query(
    'SELECT payout_bank_name, payout_account_number, payout_account_name FROM users WHERE id = $1',
    [req.user.id],
  );
  const payout = userRows[0];
  if (!payout?.payout_account_number) {
    return res.status(400).json({ error: 'Add your payout bank account in Settings → Payment Details first.' });
  }

  const { rows: tierRows } = await pool.query(
    `SELECT percentage FROM gift_card_tiers
     WHERE brand = $1 AND min_usd <= $2 AND (max_usd IS NULL OR max_usd >= $2)
     ORDER BY min_usd DESC LIMIT 1`,
    [brand, faceValueUsd],
  );
  if (!tierRows.length) return res.status(400).json({ error: 'No rate configured for that brand and amount' });

  const percentage = Number(tierRows[0].percentage);
  const payoutNgn = faceValueUsd * NGN_PER_USD * (percentage / 100);
  const payoutSummary = `${payout.payout_bank_name} · ${payout.payout_account_number} · ${payout.payout_account_name}`;
  const codeDescriptor = code ? `code ${code}` : 'code in attached photo';

  await pool.query(
    `INSERT INTO transactions
      (user_id, type, title, subtitle, amount_ngn, status, address, receipt_data, receipt_mime, receipt_filename)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      req.user.id,
      'giftcard',
      `Sell ${brand} Gift Card`,
      `$${faceValueUsd} (${percentage}%) · ${codeDescriptor} · pay to ${payoutSummary}`,
      payoutNgn,
      'Pending',
      payoutSummary,
      receiptData || null,
      receiptMime || null,
      receiptFilename || null,
    ],
  );

  res.status(202).json({
    status: 'pending_review',
    brand,
    faceValueUsd,
    percentage,
    payoutNgn,
    message: 'Submitted for verification. Payout releases once the code is confirmed.',
  });
});

module.exports = router;
