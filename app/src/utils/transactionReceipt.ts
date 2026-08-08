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

export function buildTxnReceipt(t: TxnLike, formatNgn: (n: number) => string): Receipt {
  const rows = [
    { label: 'Date', value: t.created_at ? new Date(t.created_at).toLocaleString() : '—' },
    { label: 'Amount', value: formatNgn(Math.abs(t.amount_ngn)) },
  ];
  if (t.subtitle) rows.push({ label: 'Details', value: t.subtitle });
  if (t.asset) rows.push({ label: 'Asset', value: `${t.qty ?? ''} ${t.asset}`.trim() });
  if (t.address) rows.push({ label: 'Reference / Address', value: t.address });
  rows.push({ label: 'Reference ID', value: `#${t.id}` });
  return {
    heading: t.title,
    status: t.status,
    rows,
    footerNote: t.amount_ngn < 0 ? 'Money out of your wallet.' : 'Money into your wallet.',
  };
}
