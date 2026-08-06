const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../firebase');

const router = express.Router();

router.get('/listings', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, u.name AS seller_name FROM p2p_listings p
     JOIN users u ON u.id = p.user_id
     WHERE p.status = 'Open'
     ORDER BY p.created_at DESC LIMIT 50`,
  );
  res.json(rows);
});

// Listings the current user is involved in, either side, at any stage of the
// trade lifecycle — since the open-listings feed only shows 'Open' ones.
router.get('/listings/mine', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*, seller.name AS seller_name, buyer.name AS buyer_name
     FROM p2p_listings p
     JOIN users seller ON seller.id = p.user_id
     LEFT JOIN users buyer ON buyer.id = p.buyer_id
     WHERE p.user_id = $1 OR p.buyer_id = $1
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.user.id],
  );
  res.json(rows);
});

router.post('/listings', requireAuth, async (req, res) => {
  const { side, asset, amount, rateNgn, paymentMethod } = req.body;
  if (!side || !asset || !amount || !rateNgn) {
    return res.status(400).json({ error: 'side, asset, amount and rateNgn are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO p2p_listings (user_id, side, asset, amount, rate_ngn, payment_method) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [req.user.id, side, asset, amount, rateNgn, paymentMethod || 'Bank Transfer'],
  );
  res.status(201).json(rows[0]);
});

router.post('/listings/:id/claim', requireAuth, async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM p2p_listings WHERE id = $1', [req.params.id]);
  const listing = existing[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.status !== 'Open') return res.status(400).json({ error: 'Listing is no longer open' });
  if (listing.user_id === req.user.id) return res.status(400).json({ error: "You can't claim your own listing" });

  const { rows } = await pool.query(
    "UPDATE p2p_listings SET status = 'Claimed', buyer_id = $1, claimed_at = NOW() WHERE id = $2 AND status = 'Open' RETURNING *",
    [req.user.id, req.params.id],
  );
  if (!rows.length) return res.status(400).json({ error: 'Listing was just claimed by someone else' });
  res.json(rows[0]);

  const { rows: sellerRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [listing.user_id]);
  sendPush(sellerRows[0]?.fcm_token, 'Your P2P listing was claimed', `Someone claimed your ${listing.asset} listing — coordinate payment directly with them.`);
});

function isParty(listing, userId) {
  return listing.user_id === userId || listing.buyer_id === userId;
}

router.post('/listings/:id/mark-paid', requireAuth, async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM p2p_listings WHERE id = $1', [req.params.id]);
  const listing = existing[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!isParty(listing, req.user.id)) return res.status(403).json({ error: 'Not a party to this trade' });
  if (listing.status !== 'Claimed') return res.status(400).json({ error: `Trade is ${listing.status}, not awaiting payment` });

  const { rows } = await pool.query(
    "UPDATE p2p_listings SET status = 'PaymentSent', paid_at = NOW() WHERE id = $1 RETURNING *",
    [req.params.id],
  );
  res.json(rows[0]);

  const otherPartyId = listing.user_id === req.user.id ? listing.buyer_id : listing.user_id;
  const { rows: otherRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [otherPartyId]);
  sendPush(otherRows[0]?.fcm_token, 'Payment marked as sent', 'The other party marked payment as sent — check and confirm once received.');
});

router.post('/listings/:id/confirm', requireAuth, async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM p2p_listings WHERE id = $1', [req.params.id]);
  const listing = existing[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!isParty(listing, req.user.id)) return res.status(403).json({ error: 'Not a party to this trade' });
  if (listing.status !== 'PaymentSent') return res.status(400).json({ error: 'Payment has not been marked as sent yet' });

  const { rows } = await pool.query(
    "UPDATE p2p_listings SET status = 'Completed', completed_at = NOW() WHERE id = $1 RETURNING *",
    [req.params.id],
  );
  res.json(rows[0]);

  const otherPartyId = listing.user_id === req.user.id ? listing.buyer_id : listing.user_id;
  const { rows: otherRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [otherPartyId]);
  sendPush(otherRows[0]?.fcm_token, 'Trade completed', 'The other party confirmed the trade is complete.');
});

router.post('/listings/:id/cancel', requireAuth, async (req, res) => {
  const { rows: existing } = await pool.query('SELECT * FROM p2p_listings WHERE id = $1', [req.params.id]);
  const listing = existing[0];
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (!isParty(listing, req.user.id)) return res.status(403).json({ error: 'Not a party to this trade' });
  if (!['Open', 'Claimed'].includes(listing.status)) {
    return res.status(400).json({ error: 'Trade already has payment in motion — cancellations are no longer allowed, resolve directly with the other party' });
  }

  const { rows } = await pool.query("UPDATE p2p_listings SET status = 'Cancelled' WHERE id = $1 RETURNING *", [req.params.id]);
  res.json(rows[0]);
});

module.exports = router;
