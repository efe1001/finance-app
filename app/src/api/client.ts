const BASE_URL = 'https://finance-app-backend-tzke.onrender.com/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export const api = {
  register: (name: string, email: string, password: string, phone: string, referralCode?: string, country?: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone, referralCode: referralCode || undefined, country: country || undefined }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>('/auth/me'),
  updateProfile: (body: { name?: string; email?: string; phone?: string }) =>
    request<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  submitNin: (nin: string) => request<any>('/auth/nin', { method: 'POST', body: JSON.stringify({ nin }) }),
  saveFcmToken: (token: string | null) => request<{ ok: true }>('/auth/fcm-token', { method: 'POST', body: JSON.stringify({ token }) }),

  transactions: (opts?: { limit?: number; offset?: number }) =>
    request<any[]>(`/wallet/transactions?limit=${opts?.limit ?? 20}&offset=${opts?.offset ?? 0}`),
  addTransaction: (body: {
    type: string;
    title: string;
    subtitle?: string;
    amountNgn: number;
    address?: string;
    asset?: string;
    qty?: number;
    receiptData?: string;
    receiptMime?: string;
    receiptFilename?: string;
  }) => request<any>('/wallet/transactions', { method: 'POST', body: JSON.stringify(body) }),
  deposit: (amountNgn: number) =>
    request<{ status: string; message: string }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountNgn }),
    }),
  withdraw: (body: {
    amountNgn: number;
    accountNumber: string;
    bankName: string;
    bankCode?: string;
    accountName?: string;
    narration?: string;
  }) =>
    request<{ status: string; message: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  limits: () => request<Record<string, number>>('/wallet/limits'),
  payoutAccount: () =>
    request<{ bankCode: string | null; bankName: string; accountNumber: string; accountName: string } | null>(
      '/wallet/payout-account',
    ),
  savePayoutAccount: (body: { bankCode?: string; bankName: string; accountNumber: string; accountName: string }) =>
    request<{ bankCode: string | null; bankName: string; accountNumber: string; accountName: string }>(
      '/wallet/payout-account',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  platformWallets: () => request<{ asset: string; address: string }[]>('/wallet/platform-wallets'),
  holdings: () => request<{ asset: string; amount: number }[]>('/wallet/holdings'),

  flutterwave: {
    initiateDeposit: (amountNgn: number) =>
      request<{ paymentLink: string }>('/flutterwave/initiate', {
        method: 'POST',
        body: JSON.stringify({ amountNgn }),
      }),
    banks: () => request<{ code: string; name: string }[]>('/flutterwave/banks'),
    resolveAccount: (accountNumber: string, bankCode: string) =>
      request<{ accountName: string; accountNumber: string }>('/flutterwave/resolve-account', {
        method: 'POST',
        body: JSON.stringify({ accountNumber, bankCode }),
      }),
  },

  quidax: {
    depositAddress: (asset: string) =>
      request<{ status: 'ready' | 'pending'; address: string | null }>(`/quidax/deposit-address/${asset.toLowerCase()}`),
  },

  cryptoPrices: (ids = 'bitcoin,ethereum,tether') =>
    request<Record<string, { usd: number; usd_24h_change?: number }>>(
      `/crypto/prices?ids=${ids}&vs_currency=usd`,
    ),

  giftCardRates: () =>
    request<{ brand: string; tiers: { id: number; minUsd: number; maxUsd: number | null; percentage: number }[] }[]>(
      '/giftcards/rates',
    ),
  submitGiftCard: (body: {
    brand: string;
    faceValueUsd: number;
    code?: string;
    receiptData?: string;
    receiptMime?: string;
    receiptFilename?: string;
  }) => request<any>('/giftcards/submit', { method: 'POST', body: JSON.stringify(body) }),

  p2pListings: () => request<any[]>('/p2p/listings'),
  myP2pListings: () => request<any[]>('/p2p/listings/mine'),
  createP2pListing: (body: {
    side: string;
    asset: string;
    amount: number;
    rateNgn: number;
    paymentMethod?: string;
  }) => request<any>('/p2p/listings', { method: 'POST', body: JSON.stringify(body) }),
  claimP2pListing: (id: number) => request<any>(`/p2p/listings/${id}/claim`, { method: 'POST' }),
  markP2pPaid: (id: number) => request<any>(`/p2p/listings/${id}/mark-paid`, { method: 'POST' }),
  confirmP2pTrade: (id: number) => request<any>(`/p2p/listings/${id}/confirm`, { method: 'POST' }),
  cancelP2pListing: (id: number) => request<any>(`/p2p/listings/${id}/cancel`, { method: 'POST' }),

  admin: {
    pendingTransactions: (status = 'Pending') => request<any[]>(`/admin/transactions?status=${status}`),
    approveTransaction: (id: number) => request<any>(`/admin/transactions/${id}/approve`, { method: 'POST' }),
    rejectTransaction: (id: number, note?: string) =>
      request<any>(`/admin/transactions/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    users: () => request<any[]>('/admin/users'),
    adjustBalance: (userId: number, amountNgn: number, note?: string) =>
      request<any>(`/admin/users/${userId}/adjust-balance`, {
        method: 'POST',
        body: JSON.stringify({ amountNgn, note }),
      }),
    stats: () => request<any>('/admin/stats'),
    getSettings: () => request<Record<string, string>>('/admin/settings'),
    updateSettings: (settings: Record<string, string | number>) =>
      request<{ ok: true }>('/admin/settings', { method: 'PUT', body: JSON.stringify(settings) }),
    wallets: () => request<{ asset: string; address: string; updated_at: string }[]>('/admin/wallets'),
    updateWallet: (asset: string, address: string) =>
      request<any>(`/admin/wallets/${asset}`, { method: 'PUT', body: JSON.stringify({ address }) }),
    giftCardTiers: () =>
      request<{ id: number; brand: string; minUsd: number; maxUsd: number | null; percentage: number }[]>(
        '/admin/giftcard-tiers',
      ),
    addGiftCardTier: (body: { brand: string; minUsd: number; maxUsd?: number | null; percentage: number }) =>
      request<any>('/admin/giftcard-tiers', { method: 'POST', body: JSON.stringify(body) }),
    updateGiftCardTier: (id: number, body: { minUsd?: number; maxUsd?: number | null; percentage?: number }) =>
      request<any>(`/admin/giftcard-tiers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteGiftCardTier: (id: number) =>
      request<{ ok: true }>(`/admin/giftcard-tiers/${id}`, { method: 'DELETE' }),
    approveNin: (userId: number) => request<any>(`/admin/users/${userId}/nin/approve`, { method: 'POST' }),
    rejectNin: (userId: number, note?: string) =>
      request<any>(`/admin/users/${userId}/nin/reject`, { method: 'POST', body: JSON.stringify({ note }) }),
    receiptFileUrl: (id: number) => `${BASE_URL}/admin/transactions/${id}/receipt-file?token=${encodeURIComponent(authToken ?? '')}`,
  },
};
