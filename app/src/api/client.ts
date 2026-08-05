const BASE_URL = 'http://localhost:4000/api';

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

  transactions: () => request<any[]>('/wallet/transactions'),
  addTransaction: (body: {
    type: string;
    title: string;
    subtitle?: string;
    amountNgn: number;
    status?: string;
  }) => request<any>('/wallet/transactions', { method: 'POST', body: JSON.stringify(body) }),
  deposit: (amountNgn: number) =>
    request<{ walletBalanceNgn: number }>('/wallet/deposit', {
      method: 'POST',
      body: JSON.stringify({ amountNgn }),
    }),

  cryptoPrices: (ids = 'bitcoin,ethereum,tether') =>
    request<Record<string, { usd: number }>>(`/crypto/prices?ids=${ids}&vs_currency=usd`),

  giftCardRates: () => request<{ brand: string; ratePerDollar: number }[]>('/giftcards/rates'),
  submitGiftCard: (body: {
    brand: string;
    faceValueUsd: number;
    code: string;
    userId: number;
  }) => request<any>('/giftcards/submit', { method: 'POST', body: JSON.stringify(body) }),

  p2pListings: () => request<any[]>('/p2p/listings'),
  createP2pListing: (body: {
    side: string;
    asset: string;
    amount: number;
    rateNgn: number;
    paymentMethod?: string;
  }) => request<any>('/p2p/listings', { method: 'POST', body: JSON.stringify(body) }),
};
