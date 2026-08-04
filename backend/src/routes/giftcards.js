const express = require('express');
const router = express.Router();

// Static list for now — move to DB once rates need to change without a deploy.
const CARD_RATES = [
  { brand: 'Amazon', ratePerDollar: 850 },
  { brand: 'iTunes', ratePerDollar: 720 },
  { brand: 'Steam', ratePerDollar: 680 },
  { brand: 'Google Play', ratePerDollar: 700 },
  { brand: 'Razer Gold', ratePerDollar: 630 },
  { brand: 'Sephora', ratePerDollar: 610 },
];

router.get('/rates', (req, res) => {
  res.json(CARD_RATES);
});

// Submits a card for manual review — no automatic payout. An admin confirms
// the code is valid and unredeemed before the wallet is credited.
router.post('/submit', (req, res) => {
  const { brand, faceValueUsd, code, userId } = req.body;

  const card = CARD_RATES.find(c => c.brand === brand);
  if (!card) {
    return res.status(400).json({ error: 'Unsupported card brand' });
  }
  if (!code || !faceValueUsd || !userId) {
    return res.status(400).json({ error: 'brand, faceValueUsd, code and userId are required' });
  }

  const payoutNgn = faceValueUsd * card.ratePerDollar;

  // TODO: persist to `gift_card_submissions` table with status "pending_review"
  // and surface it in the admin dashboard for manual verification.
  res.status(202).json({
    status: 'pending_review',
    brand,
    faceValueUsd,
    payoutNgn,
    message: 'Submitted for verification. Payout releases once the code is confirmed.',
  });
});

module.exports = router;
