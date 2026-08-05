const BASE_URL = 'https://finance-app-backend-tzke.onrender.com/api';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
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
  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<any>('/auth/me'),
  updateProfile: (body: { name?: string; email?: string }) =>
    request<any>('/auth/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: true }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  submitNin: (nin: string) => request<any>('/auth/nin', { method: 'POST', body: JSON.stringify({ nin }) }),

  transactions: () => request<any[]>('/wallet/transactions'),
  addTransaction: (body: {
    type: string;
    title: string;
    subtitle?: string;
    amountNgn: number;
    address?: string;
    asset?: string;
    qty?: number;
  }) => request<any>('/wallet/transactions', { method: 'POST', body: JSON.stringify(body) }),
  deposit: (amountNgn: number) =>
    request<{ status: string; message: string }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountNgn }),
    }),
  withdraw: (body: { amountNgn: number; accountNumber: string; bankName: string; narration?: string }) =>
    request<{ status: string; message: string }>('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  limits: () => request<Record<string, number>>('/wallet/limits'),
  platformWallets: () => request<{ asset: string; address: string }[]>('/wallet/platform-wallets'),
  holdings: () => request<{ asset: string; amount: number }[]>('/wallet/holdings'),

  flutterwave: {
    initiateDeposit: (amountNgn: number) =>
      request<{ paymentLink: string }>('/flutterwave/initiate', {
        method: 'POST',
        body: JSON.stringify({ amountNgn }),
      }),
  },

  cryptoPrices: (ids = 'bitcoin,ethereum,tether') =>
    request<Record<string, { usd: number; usd_24h_change?: number }>>(
      `/crypto/prices?ids=${ids}&vs_currency=usd`,
    ),

  giftCardRates: () => request<{ brand: string; ratePerDollar: number }[]>('/giftcards/rates'),
  submitGiftCard: (body: { brand: string; faceValueUsd: number; code: string }) =>
    request<any>('/giftcards/submit', { method: 'POST', body: JSON.stringify(body) }),

  p2pListings: () => request<any[]>('/p2p/listings'),
  createP2pListing: (body: {
    side: string;
    asset: string;
    amount: number;
    rateNgn: number;
    paymentMethod?: string;
  }) => request<any>('/p2p/listings', { method: 'POST', body: JSON.stringify(body) }),

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
  },
};
