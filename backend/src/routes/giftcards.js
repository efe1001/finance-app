const express = require('express');
const { pool } = require('./../db');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

router.get('/rates', async (req, res) => {
  const { rows } = await pool.query('SELECT brand, rate_per_dollar FROM gift_card_rates ORDER BY brand');
  res.json(rows.map(r => ({ brand: r.brand, ratePerDollar: Number(r.rate_per_dollar) })));
});

// Submits a card for manual review — no automatic payout. An admin confirms
// the code is valid and unredeemed before the wallet is credited.
router.post('/submit', requireAuth, async (req, res) => {
  const { brand, faceValueUsd, code } = req.body;
  if (!code || !faceValueUsd || !brand) {
    return res.status(400).json({ error: 'brand, faceValueUsd and code are required' });
  }

  const { rows: userRows } = await pool.query(
    'SELECT payout_bank_name, payout_account_number, payout_account_name FROM users WHERE id = $1',
    [req.user.id],
  );
  const payout = userRows[0];
  if (!payout?.payout_account_number) {
    return res.status(400).json({ error: 'Add your payout bank account in Settings → Payment Details first.' });
  }

  const { rows } = await pool.query('SELECT rate_per_dollar FROM gift_card_rates WHERE brand = $1', [brand]);
  if (!rows.length) return res.status(400).json({ error: 'Unsupported card brand' });

  const payoutNgn = faceValueUsd * Number(rows[0].rate_per_dollar);
  const payoutSummary = `${payout.payout_bank_name} · ${payout.payout_account_number} · ${payout.payout_account_name}`;

  await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      req.user.id,
      'giftcard',
      `Sell ${brand} Gift Card`,
      `$${faceValueUsd} · code ${code} · pay to ${payoutSummary}`,
      payoutNgn,
      'Pending',
      payoutSummary,
    ],
  );

  res.status(202).json({
    status: 'pending_review',
    brand,
    faceValueUsd,
    payoutNgn,
    message: 'Submitted for verification. Payout releases once the code is confirmed.',
  });
});

module.exports = router;
