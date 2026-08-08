import type { Receipt } from '../components/ReceiptModal';

export type TxnLike = {
  id: number;
  type?: string;
  title: string;
  subtitle: string | null;
  amount_ngn: number;
  status: string;
  address?: string | null;
  asset?: string | null;
  qty?: number | null;
  created_at?: string;
};

// Best-effort icon per transaction, shared by Home's Recent Activity and
// Wallet's History so a deposit, a bill, and a gift card sale each read
// differently at a glance instead of an identical placeholder dot.
export function txnIconKey(t: TxnLike): string {
  if (t.type === 'swap') return 'swap';
  if (t.type === 'transfer') return 'transfer';
  if (t.type === 'deposit') return 'fund';
  if (t.type === 'withdrawal') return 'withdraw';
  if (t.type === 'crypto') return 'trade';
  if (t.type === 'giftcard') return 'giftcard';
  if (t.type === 'admin_adjustment') return 'vault';
  if (t.type === 'referral_bonus') return 'users';
  if (t.type === 'bill') {
    const s = `${t.title} ${t.subtitle ?? ''}`.toLowerCase();
    if (/mtn|airtel|glo|9mobile|airtime/.test(s)) return 'airtime';
    if (/\bdata\b|\bgb\b|\bmb\b/.test(s)) return 'data';
    if (/dstv|gotv|startimes/.test(s)) return 'cableTv';
    if (/disco|electric/.test(s)) return 'electricity';
    if (/smile|spectranet/.test(s)) return 'internet';
    if (/school|university|college/.test(s)) return 'education';
    return 'bills';
  }
  return 'bills';
}

// A swap moves value between two holdings, never NGN in or out of the
// wallet, so amount_ngn is always 0 for one - showing "₦0" in a list row
// would read as a bug. The subtitle already carries "0.01 BTC → 650 USDT",
// so surface the "received" half of that as the row's headline value instead.
export function txnAmountLabel(t: TxnLike, formatNgn: (n: number) => string): string {
  if (t.type === 'swap' && t.subtitle?.includes('→')) {
    return t.subtitle.split('→')[1].trim();
  }
  return formatNgn(Math.abs(t.amount_ngn));
}

export function buildTxnReceipt(t: TxnLike, formatNgn: (n: number) => string): Receipt {
  const isSwap = t.type === 'swap';
  const rows = [
    { label: 'Date', value: t.created_at ? new Date(t.created_at).toLocaleString() : '—' },
    { label: isSwap ? 'Swapped' : 'Amount', value: isSwap ? (t.subtitle ?? '—') : formatNgn(Math.abs(t.amount_ngn)) },
  ];
  if (!isSwap && t.subtitle) rows.push({ label: t.type === 'transfer' ? (t.amount_ngn < 0 ? 'To' : 'From') : 'Details', value: t.subtitle });
  // A transfer's address column holds an internal "to:5" / "from:3" dedupe
  // marker, not a real address - showing it would just leak an implementation
  // detail into the receipt.
  if (t.address && t.type !== 'transfer') rows.push({ label: 'Reference / Address', value: t.address });
  rows.push({ label: 'Reference ID', value: `#${t.id}` });
  return {
    heading: t.title,
    status: t.status,
    rows,
    footerNote: isSwap ? 'Moved between your holdings — your NGN balance is unaffected.' : (t.amount_ngn < 0 ? 'Money out of your wallet.' : 'Money into your wallet.'),
  };
}
