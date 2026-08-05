import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import type { ScreenKey } from '../components/Drawer';
import IconBadge from '../components/IconBadge';

type TickerItem = { symbol: string; id: string; price: string };
type Transaction = { id: number; title: string; subtitle: string | null; amount_ngn: number; status: string };

const TICKER_IDS = [
  { symbol: 'BTC', id: 'bitcoin' },
  { symbol: 'USDT', id: 'tether' },
  { symbol: 'ETH', id: 'ethereum' },
];

const QUICK_ACTIONS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'deposit', label: 'Add Money', icon: 'fund' },
  { key: 'trade', label: 'Trade', icon: 'trade' },
  { key: 'p2p', label: 'P2P', icon: 'p2p' },
  { key: 'bills', label: 'Bills', icon: 'bills' },
];

export default function HomeScreen({
  onOpenDrawer,
  onNavigate,
}: {
  onOpenDrawer: () => void;
  onNavigate: (key: ScreenKey) => void;
}) {
  const { user } = useAuth();
  const { colors, mode, toggleMode } = useTheme();
  const styles = getStyles(colors);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prices, txns] = await Promise.all([
        api.cryptoPrices(TICKER_IDS.map(t => t.id).join(',')).catch(() => ({})),
        api.transactions().catch(() => []),
      ]);
      setTicker(
        TICKER_IDS.map(t => {
          const usd = (prices as any)[t.id]?.usd;
          return {
            symbol: t.symbol,
            id: t.id,
            price: usd ? `₦${(usd * 1631).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—',
          };
        }),
      );
      setActivity(txns);
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onOpenDrawer} style={styles.iconBtn}>
            <Text style={styles.iconBtnGlyph}>≡</Text>
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.greetHi}>Good evening</Text>
            <Text style={styles.greetWho}>{user?.name.split(' ')[0] ?? 'there'}</Text>
          </View>
          <TouchableOpacity onPress={toggleMode} style={styles.iconBtn}>
            <Text style={styles.iconBtnGlyph}>{mode === 'dark' ? '☀' : '☾'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceLabelRow}>
            <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
            <TouchableOpacity onPress={() => setBalanceHidden(v => !v)}>
              <Text style={styles.eyeGlyph}>{balanceHidden ? '◌' : '◉'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceAmount}>{balanceText}</Text>
          <TouchableOpacity style={styles.addMoneyBtn} onPress={() => onNavigate('deposit')}>
            <Text style={styles.addMoneyText}>Add Money</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map(qa => (
            <TouchableOpacity key={qa.key} style={styles.qaItem} onPress={() => onNavigate(qa.key)}>
              <IconBadge name={qa.icon} size={48} />
              <Text style={styles.qaLabel}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.ticker}>
          {ticker.map(item => (
            <View key={item.symbol} style={styles.tickItem}>
              <Text style={styles.tickSymbol}>{item.symbol}</Text>
              <Text style={styles.tickPrice}>{item.price}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.listHead}>RECENT ACTIVITY</Text>
        {activity.length === 0 && (
          <Text style={styles.empty}>No activity yet — your transactions will show up here.</Text>
        )}
        {activity.map((item, idx) => (
          <View key={item.id} style={[styles.activityRow, idx === activity.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={styles.activityLeft}>
              <View style={styles.activityDot} />
              <View>
                <Text style={styles.activityTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={styles.activitySub}>{item.subtitle}</Text> : null}
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.activityAmt}>₦{Math.abs(item.amount_ngn).toLocaleString()}</Text>
              <View style={[styles.pill, item.status === 'Successful' ? styles.pillOk : styles.pillPending]}>
                <Text style={[styles.pillText, { color: item.status === 'Successful' ? colors.jade : colors.signal }]}>
                  {item.status}
                </Text>
              </View>
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
    topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    iconBtnGlyph: { color: colors.ink, fontSize: 16 },
    greetHi: { color: colors.muted, fontSize: 12 },
    greetWho: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 2 },
    balanceCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, marginBottom: spacing.lg },
    balanceLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceLabel: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
    eyeGlyph: { color: colors.muted, fontSize: 14 },
    balanceAmount: { color: colors.ink, fontSize: 32, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.lg },
    addMoneyBtn: { backgroundColor: colors.signal, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
    addMoneyText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg },
    qaItem: { alignItems: 'center', gap: spacing.xs },
    qaLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
    ticker: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tickItem: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm },
    tickSymbol: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    tickPrice: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 3 },
    listHead: { color: colors.muted, fontSize: 12, letterSpacing: 0.5, marginBottom: spacing.sm },
    empty: { color: colors.muted, fontSize: 12, paddingVertical: spacing.md },
    activityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    activityLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    activityDot: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface2 },
    activityTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    activitySub: { color: colors.muted, fontSize: 11, marginTop: 2 },
    activityAmt: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    pill: { marginTop: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
    pillOk: { backgroundColor: 'rgba(52,178,126,0.15)' },
    pillPending: { backgroundColor: 'rgba(226,163,58,0.16)' },
    pillText: { fontSize: 10, fontWeight: '700' },
  });
}
