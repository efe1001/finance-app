import type { Receipt } from '../components/ReceiptModal';

export type TxnLike = {
  id: number;
  title: string;
  subtitle: string | null;
  amount_ngn: number;
  status: string;
  address?: string | null;
  asset?: string | null;
  qty?: number | null;
  created_at?: string;
};

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
