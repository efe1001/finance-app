const express = require('express');
const axios = require('axios');
const router = express.Router();

const QUIDAX_BASE_URL = 'https://www.quidax.com/api/v1';
const quidax = axios.create({
  baseURL: QUIDAX_BASE_URL,
  headers: { Authorization: `Bearer ${process.env.QUIDAX_SECRET_KEY}` },
});

// Live price feed (CoinGecko)
router.get('/prices', async (req, res) => {
  const ids = req.query.ids || 'bitcoin,ethereum,tether,usd-coin';
  const vsCurrency = req.query.vs_currency || 'usd';
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids, vs_currencies: vsCurrency, include_24hr_change: true },
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch prices', detail: err.response?.data || err.message });
  }
});

// Quidax wallets for the platform account
router.get('/wallets', async (req, res) => {
  try {
    const { data } = await quidax.get('/users/me/wallets');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch Quidax wallets', detail: err.response?.data || err.message });
  }
});

module.exports = router;
