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

    -- CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
    -- exists, so new columns on pre-existing tables need explicit migration.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_note TEXT;
  `);
}

module.exports = { pool, init };
