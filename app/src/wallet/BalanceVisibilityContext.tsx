import React, { createContext, useContext, useState } from 'react';

type BalanceVisibilityContextValue = {
  balanceHidden: boolean;
  setBalanceHidden: (hidden: boolean) => void;
  toggleBalanceHidden: () => void;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextValue | null>(null);

export function BalanceVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [balanceHidden, setBalanceHidden] = useState(false);
  const toggleBalanceHidden = () => setBalanceHidden(v => !v);
  return (
    <BalanceVisibilityContext.Provider value={{ balanceHidden, setBalanceHidden, toggleBalanceHidden }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) throw new Error('useBalanceVisibility must be used within BalanceVisibilityProvider');
  return ctx;
}
