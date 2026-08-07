import React, { createContext, useContext, useState, useCallback } from 'react';
import { api, setAuthToken } from '../api/client';

type User = {
  id: number;
  name: string;
  email: string;
  walletBalanceNgn: number;
  isAdmin: boolean;
  referralCode: string;
  ninStatus: string;
  country: string | null;
  phone: string | null;
  payoutBankCode: string | null;
  payoutBankName: string | null;
  payoutAccountNumber: string | null;
  payoutAccountName: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  justRegistered: boolean;
  clearJustRegistered: () => void;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string, referralCode?: string, country?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "just created an account" from "logged into an existing one" so
  // Root() can show the friendly notification-permission prompt only on
  // registration, and fall back to the quiet auto-request for returning users.
  const [justRegistered, setJustRegistered] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      setAuthToken(res.token);
      setUser(res.user);
      setJustRegistered(false);
      return res.user as User;
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, phone: string, referralCode?: string, country?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.register(name, email, password, phone, referralCode, country);
      setAuthToken(res.token);
      setUser(res.user);
      setJustRegistered(true);
    } catch (e: any) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setJustRegistered(false);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await api.me();
    setUser(fresh);
  }, []);

  const clearJustRegistered = useCallback(() => setJustRegistered(false), []);

  return (
    <AuthContext.Provider value={{ user, loading, error, justRegistered, clearJustRegistered, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
