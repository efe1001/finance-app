require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const p2pRoutes = require('./routes/p2p');
const cryptoRoutes = require('./routes/crypto');
const billsRoutes = require('./routes/bills');
const giftcardsRoutes = require('./routes/giftcards');
const adminRoutes = require('./routes/admin');
const flutterwaveRoutes = require('./routes/flutterwave');
const quidaxRoutes = require('./routes/quidax');

const app = express();
app.use(cors());
// Raised from Express's 100kb default to fit base64-encoded receipt uploads (~5MB raw).
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => { req.rawBody = buf.toString('utf8'); } }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Render's free tier doesn't publish a fixed outbound IP anywhere, so this is
// the only reliable way to know what IP Flutterwave (or any other outbound
// API) actually sees from this server - needed once, to whitelist it.
app.get('/debug/outbound-ip', async (req, res) => {
  try {
    const axios = require('axios');
    const { data } = await axios.get('https://api.ipify.org?format=json');
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/giftcards', giftcardsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/flutterwave', flutterwaveRoutes);
app.use('/api/quidax', quidaxRoutes);

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Finance App backend running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
