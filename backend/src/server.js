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

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/p2p', p2pRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/giftcards', giftcardsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/flutterwave', flutterwaveRoutes);

const PORT = process.env.PORT || 4000;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`Finance App backend running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
