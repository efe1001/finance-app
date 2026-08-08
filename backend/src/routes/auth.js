const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendPush } = require('../firebase');

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
    username: user.username,
    walletBalanceNgn: Number(user.wallet_balance_ngn),
    isAdmin: user.is_admin,
    referralCode: user.referral_code,
    ninStatus: user.nin_status,
    country: user.country,
    phone: user.phone,
    payoutBankCode: user.payout_bank_code,
    payoutBankName: user.payout_bank_name,
    payoutAccountNumber: user.payout_account_number,
    payoutAccountName: user.payout_account_name,
    avatarKind: user.avatar_kind,
    avatarValue: user.avatar_value,
    avatarUpdatedAt: user.avatar_updated_at,
  };
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

async function usernameTaken(pool, username, excludeUserId) {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != COALESCE($2, -1)',
    [username, excludeUserId || null],
  );
  return rows.length > 0;
}

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password, referralCode, country, phone, username } = req.body;
  if (!name || !email || !password || !phone || !username) {
    return res.status(400).json({ error: 'name, email, password, phone and username are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters, letters, numbers and underscores only' });
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  if (await usernameTaken(pool, username)) {
    return res.status(409).json({ error: 'That username is already taken — please choose another.' });
  }

  let referrer = null;
  if (referralCode) {
    const { rows: refRows } = await pool.query('SELECT id FROM users WHERE referral_code = $1', [referralCode.trim().toUpperCase()]);
    referrer = refRows[0] || null;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO users (name, email, password_hash, wallet_balance_ngn, referred_by, country, phone, username) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [name, email, passwordHash, 0, referrer?.id || null, country || null, phone, username],
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

      // The new user doesn't have an FCM token registered yet at this point in the
      // flow (that happens after their first successful login), so only the
      // already-registered referrer can actually receive a push here.
      const { rows: referrerRows } = await pool.query('SELECT fcm_token FROM users WHERE id = $1', [referrer.id]);
      sendPush(referrerRows[0]?.fcm_token, 'Referral bonus earned', `₦${bonus.toLocaleString()} was added to your wallet for referring a new user.`);
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
  const { name, email, phone, username } = req.body;
  if (!name && !email && !phone && !username) {
    return res.status(400).json({ error: 'name, email, phone or username is required' });
  }

  if (email) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already in use' });
  }
  if (username) {
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters, letters, numbers and underscores only' });
    }
    if (await usernameTaken(pool, username, req.user.id)) {
      return res.status(409).json({ error: 'That username is already taken — please choose another.' });
    }
  }

  const { rows } = await pool.query(
    'UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), username = COALESCE($4, username) WHERE id = $5 RETURNING *',
    [name || null, email || null, phone || null, username || null, req.user.id],
  );
  res.json(publicUser(rows[0]));
});

// 3MB raw, base64-encoded (~1.37x), matching the same headroom style as the
// receipt upload cap elsewhere in the app.
const MAX_AVATAR_BASE64_CHARS = 4_200_000;

router.post('/avatar', requireAuth, async (req, res) => {
  const { kind, value, data, mime } = req.body;
  if (kind === 'preset') {
    if (!value) return res.status(400).json({ error: 'value is required for a preset avatar' });
    const { rows } = await pool.query(
      `UPDATE users SET avatar_kind = 'preset', avatar_value = $1, avatar_data = NULL, avatar_mime = NULL, avatar_updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [value, req.user.id],
    );
    return res.json(publicUser(rows[0]));
  }
  if (kind === 'upload') {
    if (!data || !mime) return res.status(400).json({ error: 'data and mime are required for an uploaded avatar' });
    if (data.length > MAX_AVATAR_BASE64_CHARS) return res.status(400).json({ error: 'Image is too large (max 3MB)' });
    if (!mime.startsWith('image/')) return res.status(400).json({ error: 'Only image files are allowed' });
    const { rows } = await pool.query(
      `UPDATE users SET avatar_kind = 'upload', avatar_value = NULL, avatar_data = $1, avatar_mime = $2, avatar_updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [data, mime, req.user.id],
    );
    return res.json(publicUser(rows[0]));
  }
  res.status(400).json({ error: "kind must be 'preset' or 'upload'" });
});

// Public (no auth) so a plain <Image source={{uri}}> can load it directly -
// avatars aren't sensitive, and RN's Image component can't attach an
// Authorization header without extra plumbing.
router.get('/avatar/:userId', async (req, res) => {
  const { rows } = await pool.query(
    "SELECT avatar_data, avatar_mime FROM users WHERE id = $1 AND avatar_kind = 'upload'",
    [req.params.userId],
  );
  const row = rows[0];
  if (!row?.avatar_data) return res.status(404).send('No avatar');
  res.set('Content-Type', row.avatar_mime || 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(row.avatar_data, 'base64'));
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

// token may be explicitly null - that's how the Settings toggle turns
// notifications off, by clearing the stored token so sendPush() has nothing
// to send to, without needing to touch the OS-level permission at all.
router.post('/fcm-token', requireAuth, async (req, res) => {
  if (!('token' in req.body)) return res.status(400).json({ error: 'token is required' });
  const { token } = req.body;
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
