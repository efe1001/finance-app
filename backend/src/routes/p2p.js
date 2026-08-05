const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

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

module.exports = router;
