import React, { createContext, useContext, useState, useCallback } from 'react';

// A single shared "something changed" signal. Screens that list transactions
// (Home, Wallet) include `version` in their load effect's deps; any screen
// that creates a transaction calls refresh() on success, so those lists
// update the moment you land on them again — no manual pull-to-refresh or
// re-login needed to see a just-submitted action.
type RefreshContextValue = {
  version: number;
  refresh: () => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  return <RefreshContext.Provider value={{ version, refresh }}>{children}</RefreshContext.Provider>;
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used within RefreshProvider');
  return ctx;
}
