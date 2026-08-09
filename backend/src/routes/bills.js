const express = require('express');
const axios = require('axios');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const flw = axios.create({
  baseURL: 'https://api.flutterwave.com/v3',
  headers: { Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
});

// Flutterwave's catalog is ~300 items and doesn't change minute to minute -
// refetching on every request would be wasteful and slow. Refreshed lazily,
// at most every 6 hours.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

// Standard reseller margin, charged on top of the bill's face value (never on
// Flutterwave's own fee) - Flutterwave itself is still only ever paid the
// exact face amount, this stays with us. Shown to the user as a separate
// line item rather than folded silently into the price.
const MARKUP_RATE = 0.03;
let catalogCache = { fetchedAt: 0, byItemCode: new Map(), byCategory: {} };

// Flutterwave gives us a flat list of ~300 purchasable items with no clean
// "category" field - is_airtime and label_name are the only reliable signals
// to bucket them the way our UI presents bills. Betting and Insurance are
// deliberately absent: Flutterwave's NG catalog currently has no active
// billers for either, so showing those tabs would just be broken buttons.
function classify(item) {
  const label = (item.label_name || '').toLowerCase();
  const name = item.name || '';
  if (item.is_airtime) return 'Airtime';
  if (label.includes('smartcard')) return 'Cable TV';
  if (label.includes('meter')) return 'Electricity';
  if (label.includes('account number') && /smile|spectranet/i.test(name)) return 'Internet';
  if (label.includes('mobile number') && Number(item.amount) > 0) return 'Data';
  if (/corona|school|university|college/i.test(name)) return 'Education';
  return null;
}

// Groups items under a biller within a category (e.g. all DSTV bundles, all
// Airtel data plans) so the UI can show "pick a provider" then "pick a plan"
// instead of one flat list of 75 cable options.
function providerNameFor(category, item) {
  if (category === 'Airtime' || category === 'Data') {
    const m = item.name.match(/^(MTN|AIRTEL|GLO|9MOBILE)/i);
    return m ? m[0].toUpperCase() : item.name;
  }
  if (category === 'Cable TV') {
    const m = item.name.match(/^(DSTV|GOTV|STARTIMES)/i);
    return m ? m[0].toUpperCase() : item.biller_code;
  }
  if (category === 'Internet') {
    const m = item.name.match(/^(SMILE|SPECTRANET)/i);
    return m ? m[0].toUpperCase() : item.biller_code;
  }
  if (category === 'Electricity') {
    // Each DISCO lists separate Prepaid/Postpaid items with the meter type
    // baked into the name ("ABUJA DISCO Postpaid", "BENIN DISCO POSTPAID
    // TOPUP") - strip that suffix so both group under one readable provider
    // name instead of a raw code like "BIL204".
    return item.name.replace(/\s*(electric bills\s*)?(postpaid|prepaid)\s*(topup)?\s*$/i, '').trim() || item.biller_code;
  }
  return item.biller_code;
}

async function loadCatalog() {
  if (Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS && catalogCache.byItemCode.size > 0) {
    return catalogCache;
  }

  const { data } = await flw.get('/bill-categories?country=NG');
  const items = data.data || [];

  // Confirmed by a real failed purchase: Flutterwave's catalog has stale
  // item_codes reused across several *different* billers (e.g. item AT099
  // is listed as both "9Mobile", "Airtel Nigeria" and "MTN VTU" at once) -
  // the payment endpoint rejects these with "Invalid Biller selected" no
  // matter which of the ambiguous names you picked it under. An item_code
  // that maps to more than one distinct name is exactly that pattern, so
  // it's excluded rather than gambled on.
  const namesByItemCode = new Map();
  for (const item of items) {
    const name = item.name.trim();
    if (!namesByItemCode.has(item.item_code)) namesByItemCode.set(item.item_code, new Set());
    namesByItemCode.get(item.item_code).add(name);
  }
  const ambiguousItemCodes = new Set(
    [...namesByItemCode.entries()].filter(([, names]) => names.size > 1).map(([code]) => code),
  );

  const byItemCode = new Map();
  const byCategory = {};

  for (const item of items) {
    if (ambiguousItemCodes.has(item.item_code)) continue;
    const category = classify(item);
    if (!category) continue;

    const entry = {
      itemCode: item.item_code,
      billerCode: item.biller_code,
      name: item.name.trim(),
      provider: providerNameFor(category, item),
      amount: Number(item.amount),
      fee: Number(item.fee),
      labelName: item.label_name,
    };
    if (!byItemCode.has(entry.itemCode)) byItemCode.set(entry.itemCode, entry);

    if (!byCategory[category]) byCategory[category] = {};
    if (!byCategory[category][entry.provider]) byCategory[category][entry.provider] = [];
    if (!byCategory[category][entry.provider].some(e => e.itemCode === entry.itemCode)) {
      byCategory[category][entry.provider].push(entry);
    }
  }

  catalogCache = { fetchedAt: Date.now(), byItemCode, byCategory };
  return catalogCache;
}

router.get('/categories', requireAuth, async (req, res) => {
  try {
    const catalog = await loadCatalog();
    res.json(catalog.byCategory);
  } catch (err) {
    res.status(502).json({ error: 'Could not load billers right now', detail: err.response?.data?.message || err.message });
  }
});

router.post('/pay', requireAuth, async (req, res) => {
  const { itemCode, customerNumber, amount: clientAmount } = req.body;
  if (!itemCode || !customerNumber) {
    return res.status(400).json({ error: 'itemCode and customerNumber are required' });
  }

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (err) {
    return res.status(502).json({ error: 'Could not verify this biller right now, try again shortly' });
  }

  const item = catalog.byItemCode.get(itemCode);
  if (!item) return res.status(400).json({ error: 'Unknown or no longer available item' });

  // Fixed-price items (data/cable/internet bundles) always use the catalog
  // price - a client-supplied amount is never trusted for these, so a
  // tampered request can't buy a bigger bundle for less. Variable items
  // (airtime, electricity, most education fees) have no catalog price, so
  // the user's entered amount is what's charged.
  let billAmount = item.amount;
  if (billAmount === 0) {
    billAmount = Number(clientAmount);
    if (!billAmount || billAmount <= 0) return res.status(400).json({ error: 'amount is required for this biller' });
  }
  const markup = Math.ceil(billAmount * MARKUP_RATE);
  const totalNgn = billAmount + item.fee + markup;

  const client = await pool.connect();
  let txnId;
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query('SELECT wallet_balance_ngn FROM users WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (Number(userRows[0].wallet_balance_ngn) < totalNgn) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await client.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn - $1 WHERE id = $2', [totalNgn, req.user.id]);
    const { rows: txnRows } = await client.query(
      `INSERT INTO transactions (user_id, type, title, subtitle, amount_ngn, status, address, fee_ngn)
       VALUES ($1, 'bill', $2, $3, $4, 'Pending', $5, $6) RETURNING id`,
      [req.user.id, item.name, customerNumber, -totalNgn, customerNumber, markup],
    );
    txnId = txnRows[0].id;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Money is already reserved from the wallet at this point - every path
  // below must end in either marking the transaction Successful or
  // refunding it, never leaving it silently Pending with no way forward.
  const reference = `FA-BILL-${txnId}-${Date.now()}`;
  // Per Flutterwave's actual documented endpoint (confirmed against their
  // official docs, not the /bills endpoint with a "type" field this was
  // guessing at before) - biller and item are path segments, and the
  // customer field is customer_id, not customer.
  const payload = { country: 'NG', customer_id: customerNumber, amount: billAmount, reference };
  const path = `/billers/${item.billerCode}/items/${item.itemCode}/payment`;
  try {
    const { data } = await flw.post(path, payload);
    console.log('Bill payment raw response:', JSON.stringify(data));

    // A 2xx HTTP response means Flutterwave accepted the request - axios
    // already throws on non-2xx, and every confirmed real rejection this
    // session came back that way (an HTTP error, caught below). The exact
    // shape of a *successful* response here is still being confirmed, so
    // rather than require a specific status string we don't yet know for
    // certain and risk silently refunding a purchase that actually went
    // through (as happened once already), anything not explicitly flagged
    // failed/pending is treated as successful.
    const providerStatus = (data.data?.status || data.status || '').toLowerCase();
    if (['failed', 'error', 'cancelled', 'reversed'].includes(providerStatus)) {
      throw new Error(providerStatus);
    }
    if (providerStatus === 'pending' || providerStatus === 'in-progress') {
      await pool.query(
        "UPDATE transactions SET provider_ref = $1 WHERE id = $2",
        [data.data?.reference || reference, txnId],
      );
      return res.status(202).json({ status: 'Pending', message: `${item.name} is processing - this can take a few minutes.` });
    }

    await pool.query(
      "UPDATE transactions SET status = 'Successful', provider_ref = $1 WHERE id = $2",
      [data.data?.reference || reference, txnId],
    );
    return res.status(201).json({ status: 'Successful', message: `${item.name} purchase complete.` });
  } catch (err) {
    const detail = err.response?.data?.message || err.message;
    console.error('Bill payment failed. Path:', path, 'Payload sent:', JSON.stringify(payload), 'Flutterwave response:', JSON.stringify(err.response?.data));
    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');
      await client2.query('UPDATE users SET wallet_balance_ngn = wallet_balance_ngn + $1 WHERE id = $2', [totalNgn, req.user.id]);
      await client2.query("UPDATE transactions SET status = 'Rejected', admin_note = $1 WHERE id = $2", [detail, txnId]);
      await client2.query('COMMIT');
    } catch (rollbackErr) {
      await client2.query('ROLLBACK');
    } finally {
      client2.release();
    }
    res.status(502).json({ error: `Purchase failed and your wallet was refunded: ${detail}` });
  }
});

module.exports = router;
