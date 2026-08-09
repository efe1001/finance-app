import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Animated } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency } from '../currency/CurrencyContext';
import { useBalanceVisibility } from '../wallet/BalanceVisibilityContext';
import { useRefresh } from '../data/RefreshContext';
import { buildTxnReceipt, txnIconKey, txnAmountLabel, TxnLike } from '../utils/transactionReceipt';
import type { ScreenKey } from '../components/Drawer';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';
import BrandedLoader from '../components/BrandedLoader';
import EyeToggle from '../components/EyeToggle';

type TickerItem = { symbol: string; id: string; usd: number; changePct: number };
type Transaction = TxnLike;

const TICKER_IDS = [
  { symbol: 'BTC', id: 'bitcoin' },
  { symbol: 'USDT', id: 'tether' },
  { symbol: 'ETH', id: 'ethereum' },
];

const QUICK_ACTIONS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'deposit', label: 'Add Money', icon: 'fund' },
  { key: 'trade', label: 'Trade', icon: 'trade' },
  { key: 'swap', label: 'Swap', icon: 'swap' },
  { key: 'transfer', label: 'Send Money', icon: 'transfer' },
  { key: 'p2p', label: 'P2P', icon: 'p2p' },
  { key: 'giftcards', label: 'Gift Cards', icon: 'giftcard' },
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
  const { currency, setCurrency, format, formatNgn } = useCurrency();
  const { balanceHidden, toggleBalanceHidden } = useBalanceVisibility();
  const { version } = useRefresh();
  const styles = getStyles(colors);
  const [ticker, setTicker] = useState<TickerItem[]>([]);
  const [activity, setActivity] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activityReceipt, setActivityReceipt] = useState<Receipt | null>(null);
  const fade = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let failed = false;
      const [prices, txns] = await Promise.all([
        api.cryptoPrices(TICKER_IDS.map(t => t.id).join(',')).catch(() => { failed = true; return {}; }),
        api.transactions().catch(() => { failed = true; return []; }),
      ]);
      setTicker(
        TICKER_IDS.map(t => ({
          symbol: t.symbol,
          id: t.id,
          usd: (prices as any)[t.id]?.usd ?? 0,
          changePct: (prices as any)[t.id]?.usd_24h_change ?? 0,
        })),
      );
      setActivity(txns);
      setLoadError(failed);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, fade, version]);

  const balanceText = balanceHidden ? '••••••' : formatNgn(user?.walletBalanceNgn ?? 0);

  if (initialLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.centerFill}>
          <BrandedLoader />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>Couldn't load the latest data. Pull down to try again.</Text>
          </View>
        )}
        {user?.ninStatus === 'unverified' && (
          <TouchableOpacity style={styles.ninBanner} onPress={() => onNavigate('settings')}>
            <Text style={styles.ninBannerText}>Verify your NIN to unlock full features</Text>
            <Text style={styles.ninBannerArrow}>→</Text>
          </TouchableOpacity>
        )}
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

        <Animated.View style={{ opacity: fade }}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceLabelRow}>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <EyeToggle hidden={balanceHidden} onPress={toggleBalanceHidden} />
            </View>
            <Text style={styles.balanceAmount}>{balanceText}</Text>
            <View style={styles.balanceBtnRow}>
              <TouchableOpacity style={[styles.balanceBtn, styles.depositBtn]} onPress={() => onNavigate('deposit')}>
                <Text style={styles.depositBtnText}>Deposit ↙</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.balanceBtn, styles.withdrawBtn]} onPress={() => onNavigate('withdraw')}>
                <Text style={styles.withdrawBtnText}>Withdraw ↗</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.quickActions}>
            {QUICK_ACTIONS.map(qa => (
              <TouchableOpacity key={qa.key} style={styles.qaItem} onPress={() => onNavigate(qa.key)}>
                <IconBadge name={qa.icon} size={48} />
                <Text style={styles.qaLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tickerHead}>
            <Text style={styles.listHead}>LIVE PRICES</Text>
            <View style={styles.currencySeg}>
              <TouchableOpacity style={[styles.currencyChip, currency === 'USD' && styles.currencyChipOn]} onPress={() => setCurrency('USD')}>
                <Text style={[styles.currencyChipText, currency === 'USD' && styles.currencyChipTextOn]}>USD</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.currencyChip, currency === 'NGN' && styles.currencyChipOn]} onPress={() => setCurrency('NGN')}>
                <Text style={[styles.currencyChipText, currency === 'NGN' && styles.currencyChipTextOn]}>NGN</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.ticker}>
            {ticker.map(item => (
              <View key={item.symbol} style={styles.tickItem}>
                <Text style={styles.tickSymbol}>{item.symbol}</Text>
                <Text style={styles.tickPrice}>{item.usd ? format(item.usd, { maximumFractionDigits: item.usd > 100 ? 0 : 2 }) : '—'}</Text>
                <Text style={[styles.tickChange, item.changePct >= 0 ? { color: colors.jade } : { color: colors.ember }]}>
                  {item.changePct >= 0 ? '▲' : '▼'} {Math.abs(item.changePct).toFixed(2)}%
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.listHead}>RECENT ACTIVITY</Text>
          {activity.length === 0 && (
            <Text style={styles.empty}>No activity yet — your transactions will show up here.</Text>
          )}
          {activity.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.activityRow, idx === activity.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => setActivityReceipt(buildTxnReceipt(item, formatNgn))}>
              <View style={styles.activityLeft}>
                <IconBadge name={txnIconKey(item)} size={34} glyphSize={13} />
                <View style={styles.activityTextWrap}>
                  <Text style={styles.activityTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
                  {item.subtitle ? <Text style={styles.activitySub} numberOfLines={1} ellipsizeMode="tail">{item.subtitle}</Text> : null}
                </View>
              </View>
              <View style={styles.activityRight}>
                <Text style={styles.activityAmt} numberOfLines={1}>{txnAmountLabel(item, formatNgn)}</Text>
                <View style={[styles.pill, item.status === 'Successful' ? styles.pillOk : styles.pillPending]}>
                  <Text style={[styles.pillText, { color: item.status === 'Successful' ? colors.jade : colors.signal }]} numberOfLines={1}>
                    {item.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
      <ReceiptModal receipt={activityReceipt} onClose={() => setActivityReceipt(null)} colors={colors} />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 4 },
    errorBanner: { backgroundColor: 'rgba(226,96,77,0.1)', borderWidth: 1, borderColor: colors.ember, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    errorBannerText: { color: colors.ember, fontSize: 11.5, lineHeight: 16 },
    ninBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(226,163,58,0.1)', borderWidth: 1, borderColor: colors.signal, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    ninBannerText: { color: colors.ink, fontSize: 12.5, fontWeight: '600', flex: 1 },
    ninBannerArrow: { color: colors.signal, fontSize: 16, fontWeight: '700' },
    topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    iconBtnGlyph: { color: colors.ink, fontSize: 16 },
    greetHi: { color: colors.muted, fontSize: 12 },
    greetWho: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 2 },
    // Solid violet hero - flat fill, no gradient (matching the rest of the new
    // icon/theme system, which deliberately avoids gradients and metallics).
    balanceCard: { backgroundColor: colors.signal, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
    balanceLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    balanceLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11, letterSpacing: 1, fontWeight: '700' },
    balanceAmount: { color: colors.signalInk, fontSize: 32, fontWeight: '800', marginTop: spacing.sm, marginBottom: spacing.lg },
    balanceBtnRow: { flexDirection: 'row', gap: spacing.sm },
    balanceBtn: { flex: 1, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
    depositBtn: { backgroundColor: colors.signalInk },
    withdrawBtn: { backgroundColor: 'rgba(255,255,255,0.16)' },
    depositBtnText: { color: colors.signal, fontWeight: '700', fontSize: 14 },
    withdrawBtnText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    // Wraps instead of a single non-shrinking row - the row only had headroom
    // for ~5 items before this and now carries 7, so wrapping keeps future
    // additions safe without needing to re-tune spacing every time.
    quickActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg, marginBottom: spacing.lg },
    qaItem: { alignItems: 'center', gap: spacing.xs, width: '23%' },
    qaLabel: { color: colors.muted, fontSize: 10, textAlign: 'center' },
    tickerHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    currencySeg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 3, gap: 2 },
    currencyChip: { paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill },
    currencyChipOn: { backgroundColor: colors.signal },
    currencyChipText: { color: colors.muted, fontSize: 10.5, fontWeight: '700' },
    currencyChipTextOn: { color: colors.signalInk },
    ticker: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    tickItem: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm },
    tickSymbol: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    tickPrice: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 3 },
    tickChange: { fontSize: 10, fontWeight: '700', marginTop: 2 },
    listHead: { color: colors.muted, fontSize: 12, letterSpacing: 0.5, marginBottom: spacing.sm },
    empty: { color: colors.muted, fontSize: 12, paddingVertical: spacing.md },
    activityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    activityLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginRight: spacing.sm },
    activityTextWrap: { flex: 1 },
    activityTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    activitySub: { color: colors.muted, fontSize: 11, marginTop: 2 },
    activityRight: { flexShrink: 0, alignItems: 'flex-end' },
    activityAmt: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    pill: { marginTop: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
    pillOk: { backgroundColor: 'rgba(52,178,126,0.15)' },
    pillPending: { backgroundColor: 'rgba(226,163,58,0.16)' },
    pillText: { fontSize: 10, fontWeight: '700' },
  });
}
