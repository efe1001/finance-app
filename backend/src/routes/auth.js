const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// 10 attempts per 15 minutes per IP - slows brute-force guessing without
// locking out a real user who just fat-fingers their password a few times.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

function issueToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    walletBalanceNgn: Number(user.wallet_balance_ngn),
    isAdmin: user.is_admin,
    referralCode: user.referral_code,
    ninStatus: user.nin_status,
  };
}

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, referralCode } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  let referrer = null;
  if (referralCode) {
    const { rows: refRows } = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim().toUpperCase()]);
    referrer = refRows[0] || null;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, wallet_balance_ngn, referred_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, email, passwordHash, 0, referrer?.id || null],
  );

  let user = rows[0];
  await pool.query("UPDATE users SET referral_code = 'FA' || LPAD(id::text, 6, '0') WHERE id = $1", [user.id]);
  user.referral_code = 'FA' + String(user.id).padStart(6, '0');

  if (referrer) {
    const { rows: settingsRows } = await pool.query("SELECT value FROM settings WHERE key = 'referral_bonus_ngn'");
    const bonus = Number(settingsRows[0]?.value || 0);
    if (bonus > 0) {
      await pool.query(
        `INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status) VALUES
          ($1, 'referral_bonus', 'Referral Bonus', 'For referring a new user', $2, 'Successful'),
          ($3, 'referral_bonus', 'Referral Bonus', 'For signing up with a referral code', $2, 'Successful')`,
        [referrer.id, bonus, user.id],
      );
      await pool.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = ANY($2)', [bonus, [referrer.id, user.id]]);
      user.wallet_balance_ngn = Number(user.wallet_balance_ngn) + bonus;
    }
  }

  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(user));
});

router.put('/profile', requireAuth, async (req, res) => {
  const { name, email } = req.body;
  if (!name && !email) return res.status(400).json({ error: 'name or email is required' });

  if (email) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });
  }

  const { rows } = await pool.query(
    'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3 RETURNING *',
    [name || null, email || null, req.user.id],
  );
  res.json(publicUser(rows[0]));
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
  res.json({ ok: true });
});

router.post('/fcm-token', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token is required' });
  await pool.query('UPDATE users SET fcm_token = $1 WHERE id = $2', [token, req.user.id]);
  res.json({ ok: true });
});

router.post('/nin', requireAuth, async (req, res) => {
  const { nin } = req.body;
  if (!nin || nin.length !== 11) return res.status(400).json({ error: 'NIN must be 11 digits' });
  await pool.query("UPDATE users SET nin = $1, nin_status = 'pending' WHERE id = $2", [nin, req.user.id]);
  res.json({ ninStatus: 'pending' });
});

module.exports = router;
