import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../currency/CurrencyContext';
import { useBalanceVisibility } from '../wallet/BalanceVisibilityContext';
import type { ScreenKey } from '../components/Drawer';
import IconBadge from '../components/IconBadge';

type Holding = { symbol: string; icon: string; usd: number; changePct: number; qty: number };
type Transaction = { id: number; title: string; subtitle: string | null; amount_ngn: number; status: string };

const ASSETS = [
  { symbol: 'BTC', id: 'bitcoin', icon: 'bitcoin' },
  { symbol: 'ETH', id: 'ethereum', icon: 'ethereum' },
  { symbol: 'USDT', id: 'tether', icon: 'tether' },
  { symbol: 'USDC', id: 'usd-coin', icon: 'usd-coin' },
  { symbol: 'BNB', id: 'binancecoin', icon: 'binancecoin' },
  { symbol: 'SOL', id: 'solana', icon: 'solana' },
  { symbol: 'XRP', id: 'ripple', icon: 'ripple' },
  { symbol: 'DOGE', id: 'dogecoin', icon: 'dogecoin' },
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
  const { currency, setCurrency, format, formatNgn } = useCurrency();
  const { balanceHidden, toggleBalanceHidden } = useBalanceVisibility();
  const styles = getStyles(colors);
  const [tab, setTab] = useState<'holdings' | 'history'>('holdings');
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const PAGE_SIZE = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prices, txns, myHoldings] = await Promise.all([
        api.cryptoPrices(ASSETS.map(a => a.id).join(',')).catch(() => ({})),
        api.transactions({ limit: PAGE_SIZE, offset: 0 }).catch(() => []),
        api.holdings().catch(() => []),
      ]);
      setHoldings(
        ASSETS.map(a => {
          const held = (myHoldings as any[]).find(h => h.asset === a.symbol);
          return {
            symbol: a.symbol,
            icon: a.icon,
            usd: (prices as any)[a.id]?.usd ?? 0,
            changePct: (prices as any)[a.id]?.usd_24h_change ?? 0,
            qty: held ? Number(held.amount) : 0,
          };
        }),
      );
      setHistory(txns);
      setHistoryPage(0);
      setHasMoreHistory(txns.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMoreHistory() {
    if (loadingMore || !hasMoreHistory) return;
    setLoadingMore(true);
    try {
      const nextPage = historyPage + 1;
      const more = await api.transactions({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      setHistory(h => [...h, ...more]);
      setHistoryPage(nextPage);
      setHasMoreHistory(more.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    load();
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [load, fade]);

  const balanceText = balanceHidden ? '••••••' : formatNgn(user?.walletBalanceNgn ?? 0);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        <View style={styles.balanceHead}>
          <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <View style={styles.currencySeg}>
              <TouchableOpacity style={[styles.currencyChip, currency === 'USD' && styles.currencyChipOn]} onPress={() => setCurrency('USD')}>
                <Text style={[styles.currencyChipText, currency === 'USD' && styles.currencyChipTextOn]}>USD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.currencyChip, currency === 'NGN' && styles.currencyChipOn]} onPress={() => setCurrency('NGN')}>
                <Text style={[styles.currencyChipText, currency === 'NGN' && styles.currencyChipTextOn]}>NGN</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={toggleBalanceHidden} style={styles.eyeBtn} hitSlop={10}>
              <Text style={styles.eyeGlyph}>{balanceHidden ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.balanceAmount}>{balanceText}</Text>

        <Animated.View style={{ opacity: fade }}>
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
                      <Text style={[styles.holdingChange, h.changePct >= 0 ? { color: colors.jade } : { color: colors.ember }]}>
                        {h.changePct >= 0 ? '▲' : '▼'} {Math.abs(h.changePct).toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.holdingValue}>{format(h.qty * h.usd)}</Text>
                    <Text style={styles.holdingPrice}>{h.qty.toFixed(6)} {h.symbol}</Text>
                  </View>
                </View>
              ))
            : history.length === 0
            ? <Text style={styles.empty}>No transactions yet.</Text>
            : (
              <>
                {history.map(t => (
                  <View key={t.id} style={styles.holdingRow}>
                    <View>
                      <Text style={styles.holdingSymbol}>{t.title}</Text>
                      {t.subtitle ? <Text style={styles.holdingChange}>{t.subtitle}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.holdingValue}>{formatNgn(Math.abs(t.amount_ngn))}</Text>
                      <Text style={styles.holdingPrice}>{t.status}</Text>
                    </View>
                  </View>
                ))}
                {hasMoreHistory && (
                  <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMoreHistory} disabled={loadingMore}>
                    <Text style={styles.loadMoreText}>{loadingMore ? 'Loading…' : 'Load More'}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
        </Animated.View>
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
    eyeBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    eyeGlyph: { fontSize: 18 },
    currencySeg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, gap: 2 },
    currencyChip: { paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill },
    currencyChipOn: { backgroundColor: colors.signal },
    currencyChipText: { color: colors.muted, fontSize: 10.5, fontWeight: '700' },
    currencyChipTextOn: { color: colors.signalInk },
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
    loadMoreBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
    loadMoreText: { color: colors.signal, fontSize: 12.5, fontWeight: '700' },
  });
}
