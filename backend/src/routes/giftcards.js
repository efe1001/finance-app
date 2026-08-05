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

  const { rows } = await pool.query('SELECT rate_per_dollar FROM gift_card_rates WHERE brand = $1', [brand]);
  if (!rows.length) return res.status(400).json({ error: 'Unsupported card brand' });

  const payoutNgn = faceValueUsd * Number(rows[0].rate_per_dollar);

  await pool.query(
    'INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [req.user.id, 'giftcard', `Sell ${brand} Gift Card`, `$${faceValueUsd} · code ${code}`, payoutNgn, 'Pending', code],
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
