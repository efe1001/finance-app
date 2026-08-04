const express = require('express');
const axios = require('axios');
const router = express.Router();

const flutterwave = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_PUBLIC_KEY}` },
});

// List available bill/airtime billers (e.g. AIRTIME, DSTV, PHCN)
router.get('/billers/:country', async (req, res) => {
  try {
    const { data } = await flutterwave.get(`/bill-categories?country=${req.params.country}`);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch billers', detail: err.response?.data || err.message });
  }
});

module.exports = router;
