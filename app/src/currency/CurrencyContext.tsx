import React, { createContext, useContext, useState, useMemo } from 'react';

export type Currency = 'USD' | 'NGN';

// Static fallback rate — swapped for a live FX rate once a rates API is wired in.
const NGN_PER_USD = 1631;

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  symbol: string;
  fromUsd: (usd: number) => number;
  format: (usd: number, opts?: { maximumFractionDigits?: number }) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('USD');

  const value = useMemo<CurrencyContextValue>(() => {
    const symbol = currency === 'USD' ? '$' : '₦';
    const fromUsd = (usd: number) => (currency === 'USD' ? usd : usd * NGN_PER_USD);
    const format = (usd: number, opts?: { maximumFractionDigits?: number }) =>
      `${symbol}${fromUsd(usd).toLocaleString(undefined, {
        maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
      })}`;
    return { currency, setCurrency, symbol, fromUsd, format };
  }, [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
