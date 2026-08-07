import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { isSensorAvailable, simplePrompt } from '@sbaiahmed1/react-native-biometrics';

type AppLockContextValue = {
  supported: boolean;
  enabled: boolean;
  locked: boolean;
  setEnabled: (v: boolean) => void;
  unlock: () => Promise<boolean>;
};

const AppLockContext = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    isSensorAvailable()
      .then(info => setSupported(!!info.available))
      .catch(() => setSupported(false));
  }, []);

  // Toggling on happens right after a successful unlock() prompt (see SettingsScreen),
  // so don't immediately re-lock — only future backgrounding should trigger that.
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    setLocked(false);
  }, []);

  const unlock = useCallback(async () => {
    try {
      const result = await simplePrompt('Unlock Finance App');
      if (result.success) setLocked(false);
      return result.success;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (enabled && appState.current === 'active' && next.match(/inactive|background/)) {
        setLocked(true);
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled]);

  return (
    <AppLockContext.Provider value={{ supported, enabled, locked, setEnabled, unlock }}>
      {children}
    </AppLockContext.Provider>
  );
}

export function useAppLock() {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock must be used within AppLockProvider');
  return ctx;
}
