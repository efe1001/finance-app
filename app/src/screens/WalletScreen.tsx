import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import type { ScreenKey } from '../components/Drawer';
import IconBadge from '../components/IconBadge';

type Holding = { symbol: string; icon: string; price: number; change: number };
type Transaction = { id: number; title: string; subtitle: string | null; amount_ngn: number; status: string };

const ASSETS = [
  { symbol: 'BTC', id: 'bitcoin', icon: 'bitcoin' },
  { symbol: 'ETH', id: 'ethereum', icon: 'ethereum' },
  { symbol: 'USDT', id: 'tether', icon: 'tether' },
];

const ACTIONS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'withdraw', label: 'Withdraw', icon: 'withdraw' },
  { key: 'trade', label: 'Trade', icon: 'trade' },
  { key: 'p2p', label: 'P2P', icon: 'p2p' },
  { key: 'deposit', label: 'Add Money', icon: 'fund' },
];

export default function WalletScreen({
  onNavigate,
  colors,
}: {
  onNavigate: (key: ScreenKey) => void;
  colors: ThemeColors;
}) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const [tab, setTab] = useState<'holdings' | 'history'>('holdings');
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prices, txns] = await Promise.all([
        api.cryptoPrices(ASSETS.map(a => a.id).join(',')).catch(() => ({})),
        api.transactions().catch(() => []),
      ]);
      setHoldings(
        ASSETS.map(a => ({
          symbol: a.symbol,
          icon: a.icon,
          price: (prices as any)[a.id]?.usd ?? 0,
          change: (prices as any)[a.id]?.usd_24h_change ?? 0,
        })),
      );
      setHistory(txns);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const balanceText = balanceHidden
    ? '••••••'
    : `₦${(user?.walletBalanceNgn ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        <View style={styles.balanceHead}>
          <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
          <TouchableOpacity onPress={() => setBalanceHidden(v => !v)}>
            <Text style={styles.eyeGlyph}>{balanceHidden ? '◌' : '◉'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceAmount}>{balanceText}</Text>

        <View style={styles.actionsRow}>
          {ACTIONS.map(a => (
            <TouchableOpacity key={a.key} style={styles.actionItem} onPress={() => onNavigate(a.key)}>
              <IconBadge name={a.icon} size={46} />
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity style={[styles.tabBtn, tab === 'holdings' && styles.tabBtnOn]} onPress={() => setTab('holdings')}>
            <Text style={[styles.tabText, tab === 'holdings' && styles.tabTextOn]}>All Holdings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, tab === 'history' && styles.tabBtnOn]} onPress={() => setTab('history')}>
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextOn]}>Transaction History</Text>
          </TouchableOpacity>
        </View>

        {tab === 'holdings'
          ? holdings.map(h => (
              <View key={h.symbol} style={styles.holdingRow}>
                <View style={styles.holdingLeft}>
                  <IconBadge name={h.icon} size={40} />
                  <View>
                    <Text style={styles.holdingSymbol}>{h.symbol}</Text>
                    <Text style={[styles.holdingChange, h.change >= 0 ? { color: colors.jade } : { color: colors.ember }]}>
                      {h.change >= 0 ? '▲' : '▼'} {Math.abs(h.change).toFixed(2)}%
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.holdingValue}>$0.00</Text>
                  <Text style={styles.holdingPrice}>${h.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                </View>
              </View>
            ))
          : history.length === 0
          ? <Text style={styles.empty}>No transactions yet.</Text>
          : history.map(t => (
              <View key={t.id} style={styles.holdingRow}>
                <View>
                  <Text style={styles.holdingSymbol}>{t.title}</Text>
                  {t.subtitle ? <Text style={styles.holdingChange}>{t.subtitle}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.holdingValue}>₦{Math.abs(t.amount_ngn).toLocaleString()}</Text>
                  <Text style={styles.holdingPrice}>{t.status}</Text>
                </View>
              </View>
            ))}
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    balanceHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
    eyeGlyph: { color: colors.muted, fontSize: 14 },
    balanceAmount: { color: colors.ink, fontSize: 30, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.lg },
    actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xl },
    actionItem: { alignItems: 'center', gap: spacing.xs },
    actionLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '600' },
    tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tabBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    tabBtnOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    tabText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    tabTextOn: { color: colors.signalInk },
    holdingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    holdingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    holdingSymbol: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    holdingChange: { fontSize: 11, marginTop: 2, color: colors.muted },
    holdingValue: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    holdingPrice: { color: colors.muted, fontSize: 11, marginTop: 2 },
    empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
  });
}
