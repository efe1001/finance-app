import React, { createContext, useContext, useState, useMemo } from 'react';

export type Currency = 'USD' | 'NGN' | 'GBP' | 'EUR' | 'CAD' | 'GHS' | 'KES' | 'ZAR';

// Static fallback rates (units per 1 USD) — swapped for a live FX rate once a rates API is wired in.
export const CURRENCIES: { code: Currency; label: string; symbol: string; perUsd: number }[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$', perUsd: 1 },
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦', perUsd: 1631 },
  { code: 'GBP', label: 'British Pound', symbol: '£', perUsd: 0.79 },
  { code: 'EUR', label: 'Euro', symbol: '€', perUsd: 0.92 },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$', perUsd: 1.37 },
  { code: 'GHS', label: 'Ghanaian Cedi', symbol: 'GH₵', perUsd: 15.3 },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh', perUsd: 129 },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R', perUsd: 18.1 },
];

const NGN_PER_USD = CURRENCIES.find(c => c.code === 'NGN')!.perUsd;

export const COUNTRIES: { name: string; currency: Currency }[] = [
  { name: 'Nigeria', currency: 'NGN' },
  { name: 'United States', currency: 'USD' },
  { name: 'United Kingdom', currency: 'GBP' },
  { name: 'Ghana', currency: 'GHS' },
  { name: 'Kenya', currency: 'KES' },
  { name: 'South Africa', currency: 'ZAR' },
  { name: 'Canada', currency: 'CAD' },
  { name: 'Germany', currency: 'EUR' },
  { name: 'France', currency: 'EUR' },
  { name: 'Other', currency: 'USD' },
];

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  symbol: string;
  fromUsd: (usd: number) => number;
  toUsd: (amountInCurrency: number) => number;
  format: (usd: number, opts?: { maximumFractionDigits?: number }) => string;
  fromNgn: (ngn: number) => number;
  toNgn: (amountInCurrency: number) => number;
  formatNgn: (ngn: number, opts?: { maximumFractionDigits?: number }) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('USD');

  const value = useMemo<CurrencyContextValue>(() => {
    const meta = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[0];
    const fromUsd = (usd: number) => usd * meta.perUsd;
    const toUsd = (amountInCurrency: number) => amountInCurrency / meta.perUsd;
    const format = (usd: number, opts?: { maximumFractionDigits?: number }) =>
      `${meta.symbol}${fromUsd(usd).toLocaleString(undefined, {
        maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
      })}`;
    const fromNgn = (ngn: number) => (ngn / NGN_PER_USD) * meta.perUsd;
    const toNgn = (amountInCurrency: number) => (amountInCurrency / meta.perUsd) * NGN_PER_USD;
    const formatNgn = (ngn: number, opts?: { maximumFractionDigits?: number }) =>
      `${meta.symbol}${fromNgn(ngn).toLocaleString(undefined, {
        maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
      })}`;
    return { currency, setCurrency, symbol: meta.symbol, fromUsd, toUsd, format, fromNgn, toNgn, formatNgn };
  }, [currency]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
