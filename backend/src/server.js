require('dotenv').config();
const express = require('express');
const cors = require('cors');

const cryptoRoutes = require('./routes/crypto');
const billsRoutes = require('./routes/bills');
const giftcardsRoutes = require('./routes/giftcards');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/crypto', cryptoRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/giftcards', giftcardsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Finance App backend running on port ${PORT}`));
