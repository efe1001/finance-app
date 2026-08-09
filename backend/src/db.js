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
      ('max_withdrawal_ngn', '2000000'),
      ('referral_bonus_ngn', '0')
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

    -- Tiered payout percentages, replacing the flat gift_card_rates above: the
    -- bigger the card, the better the percentage of face value paid out.
    -- Percentage is applied to face-value-in-USD converted at the app's
    -- standard NGN_PER_USD rate, so the "you receive" figure round-trips
    -- cleanly back through currency conversion instead of drifting.
    CREATE TABLE IF NOT EXISTS gift_card_tiers (
      id SERIAL PRIMARY KEY,
      brand TEXT NOT NULL,
      min_usd NUMERIC NOT NULL DEFAULT 0,
      max_usd NUMERIC,
      percentage NUMERIC NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    INSERT INTO gift_card_tiers (brand, min_usd, max_usd, percentage)
    SELECT * FROM (VALUES
      ('Amazon', 0::numeric, 49.99::numeric, 55::numeric),
      ('Amazon', 50, 199.99, 62),
      ('Amazon', 200, NULL, 70),
      ('iTunes', 0, 49.99, 48),
      ('iTunes', 50, 199.99, 55),
      ('iTunes', 200, NULL, 62),
      ('Steam', 0, 49.99, 45),
      ('Steam', 50, 199.99, 52),
      ('Steam', 200, NULL, 59),
      ('Google Play', 0, 49.99, 46),
      ('Google Play', 50, 199.99, 53),
      ('Google Play', 200, NULL, 60),
      ('Razer Gold', 0, 49.99, 42),
      ('Razer Gold', 50, 199.99, 49),
      ('Razer Gold', 200, NULL, 56),
      ('Sephora', 0, 49.99, 40),
      ('Sephora', 50, 199.99, 47),
      ('Sephora', 200, NULL, 54)
    ) AS seed(brand, min_usd, max_usd, percentage)
    WHERE NOT EXISTS (SELECT 1 FROM gift_card_tiers LIMIT 1);

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
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS admin_id INTEGER REFERENCES users(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_bank_code TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_number TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE p2p_listings ADD COLUMN IF NOT EXISTS buyer_id INTEGER REFERENCES users(id);
    ALTER TABLE p2p_listings ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;
    ALTER TABLE p2p_listings ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
    ALTER TABLE p2p_listings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
    -- Ticker symbols collide across coins (many unrelated tokens all use "SHIB",
    -- etc), so once trading opened up beyond the fixed 8-asset list, the symbol
    -- alone stopped being enough to re-price a holding later - the CoinGecko id
    -- picked at trade/swap time is stored alongside it for that.
    ALTER TABLE holdings ADD COLUMN IF NOT EXISTS coingecko_id TEXT;
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS coingecko_id TEXT;

    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    -- Case-insensitive uniqueness ("Efe" and "efe" would otherwise both be
    -- takeable) via a partial index, since a plain UNIQUE column would still
    -- allow that collision and would also reject the many existing accounts
    -- that don't have a username yet (NULL) if it weren't partial.
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username)) WHERE username IS NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_kind TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_value TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_data TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_mime TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_updated_at TIMESTAMP;

    -- Business revenue (bills markup, swap spread) captured at the moment each
    -- transaction happens, kept separate from amount_ngn so it can be summed
    -- without re-deriving it from title/subtitle text. Only populated for
    -- transaction types where the fee is a clean, known formula - not gift
    -- cards or crypto trades, where any margin isn't something the app can
    -- see (it depends on what the card resells for, or what the admin
    -- actually pays/charges when fulfilling a trade by hand).
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fee_ngn NUMERIC NOT NULL DEFAULT 0;

    -- Splits a user's balance into what's actually sitting liquid
    -- (wallet_balance_ngn) versus what's currently out funding lending or
    -- investment activity on their behalf. Their total (the two summed)
    -- never changes when money moves between them - this is a disclosed
    -- re-labeling visible in the user's own balance and history, never a
    -- silent reduction.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS invested_balance_ngn NUMERIC NOT NULL DEFAULT 0;

    UPDATE users SET referral_code = 'FA' || LPAD(id::text, 6, '0') WHERE referral_code IS NULL;
  `);
}

module.exports = { pool, init };
