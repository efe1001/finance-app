const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      wallet_balance_ngn NUMERIC NOT NULL DEFAULT 0,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      amount_ngn NUMERIC NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending',
      address TEXT,
      admin_note TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS p2p_listings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      side TEXT NOT NULL,
      asset TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      rate_ngn NUMERIC NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Bank Transfer',
      status TEXT NOT NULL DEFAULT 'Open',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    INSERT INTO settings (key, value) VALUES
      ('min_deposit_ngn', '1000'),
      ('max_deposit_ngn', '5000000'),
      ('min_withdrawal_ngn', '1000'),
      ('max_withdrawal_ngn', '2000000')
    ON CONFLICT (key) DO NOTHING;

    CREATE TABLE IF NOT EXISTS platform_wallets (
      asset TEXT PRIMARY KEY,
      address TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    INSERT INTO platform_wallets (asset, address) VALUES
      ('BTC', ''), ('ETH', ''), ('USDT', ''),
      ('USDC', ''), ('BNB', ''), ('SOL', ''), ('XRP', ''), ('DOGE', '')
    ON CONFLICT (asset) DO NOTHING;

    CREATE TABLE IF NOT EXISTS holdings (
      user_id INTEGER NOT NULL REFERENCES users(id),
      asset TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, asset)
    );

    CREATE TABLE IF NOT EXISTS gift_card_rates (
      brand TEXT PRIMARY KEY,
      rate_per_dollar NUMERIC NOT NULL
    );

    INSERT INTO gift_card_rates (brand, rate_per_dollar) VALUES
      ('Amazon', 850), ('iTunes', 720), ('Steam', 680),
      ('Google Play', 700), ('Razer Gold', 630), ('Sephora', 610)
    ON CONFLICT (brand) DO NOTHING;

    CREATE TABLE IF NOT EXISTS quidax_addresses (
      user_id INTEGER NOT NULL REFERENCES users(id),
      asset TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      address TEXT,
      network TEXT,
      quidax_wallet_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, asset)
    );

    -- CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
    -- exists, so new columns on pre-existing tables need explicit migration.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS nin TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS nin_status TEXT NOT NULL DEFAULT 'unverified';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS quidax_user_id TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_note TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS asset TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS qty NUMERIC;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS provider_ref TEXT UNIQUE;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_data TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_mime TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_filename TEXT;

    UPDATE users SET referral_code = 'FA' || LPAD(id::text, 6, '0') WHERE referral_code IS NULL;
  `);
}

module.exports = { pool, init };
