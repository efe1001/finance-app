const express = require('express');
const axios = require('axios');
const router = express.Router();

const quidax = axios.create({
  baseURL: 'https://openapi.quidax.io/exchange-open-api/api/v1',
  headers: { Authorization: `Bearer ${process.env.QUIDAX_API_KEY}` },
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

// Full-catalog search for the asset pickers (Trade/Swap) - lets users find any
// coin CoinGecko indexes, not just the short "popular" starter list. Results
// carry market_cap_rank so the client can still rank popular hits first.
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ coins: [] });
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/search', {
      params: { query: q },
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    const coins = (data.coins || []).slice(0, 30).map(c => ({
      id: c.id,
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name,
      thumb: c.thumb,
      marketCapRank: c.market_cap_rank ?? null,
    }));
    res.json({ coins });
  } catch (err) {
    res.status(502).json({ error: 'Search failed', detail: err.response?.data || err.message });
  }
});

// Top coins by market cap - the default list shown in the asset pickers before
// a user types anything, already carrying live price so a fresh pick doesn't
// need a second round trip.
router.get('/top', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: limit, page: 1, sparkline: false },
      headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY },
    });
    const coins = data.map(c => ({
      id: c.id,
      symbol: (c.symbol || '').toUpperCase(),
      name: c.name,
      thumb: c.image,
      marketCapRank: c.market_cap_rank ?? null,
      priceUsd: c.current_price,
      change24h: c.price_change_percentage_24h,
    }));
    res.json({ coins });
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch top coins', detail: err.response?.data || err.message });
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
