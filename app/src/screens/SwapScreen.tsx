import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRefresh } from '../data/RefreshContext';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';
import BrandedLoader from '../components/BrandedLoader';
import AssetPickerModal, { PickedAsset } from '../components/AssetPickerModal';

const ASSETS: PickedAsset[] = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'tether', symbol: 'USDT' },
  { id: 'usd-coin', symbol: 'USDC' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE' },
];

// Mirrors SWAP_SPREAD in backend/src/routes/wallet.js - the backend remains
// authoritative for what actually gets credited, this is only so the
// preview shown before confirming matches what will really happen.
const SWAP_SPREAD = 0.01;

export default function SwapScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { refreshUser } = useAuth();
  const { refresh } = useRefresh();
  const styles = getStyles(colors);

  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fromAsset, setFromAsset] = useState<PickedAsset>(ASSETS[0]);
  const [toAsset, setToAsset] = useState<PickedAsset>(ASSETS[2]);
  const [fromInput, setFromInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [swapReceipt, setSwapReceipt] = useState<Receipt | null>(null);
  const [pickerFor, setPickerFor] = useState<'from' | 'to' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, h] = await Promise.all([
        api.cryptoPrices(ASSETS.map(a => a.id).join(',')),
        api.holdings().catch(() => []),
      ]);
      setPrices(prev => ({ ...prev, ...p }));
      const map: Record<string, number> = {};
      (h as { asset: string; amount: number }[]).forEach(x => (map[x.asset] = Number(x.amount)));
      setHoldings(map);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Prices are preloaded for the 8 starter assets only - anything picked via
  // the search picker needs its own one-off fetch.
  useEffect(() => {
    [fromAsset.id, toAsset.id].forEach(id => {
      if (!prices[id]) {
        api.cryptoPrices(id).then(p => setPrices(prev => ({ ...prev, ...p }))).catch(() => {});
      }
    });
  }, [fromAsset.id, toAsset.id, prices]);

  const fromPrice = prices[fromAsset.id]?.usd ?? 0;
  const toPrice = prices[toAsset.id]?.usd ?? 0;
  const fromHeld = holdings[fromAsset.symbol] ?? 0;
  const fromQty = parseFloat(fromInput || '0');
  const toQty = fromPrice && toPrice ? ((fromQty * fromPrice) / toPrice) * (1 - SWAP_SPREAD) : 0;
  const overHeld = fromQty > fromHeld && fromQty > 0;
  const canSubmit = fromQty > 0 && !overHeld && fromAsset.symbol !== toAsset.symbol;

  function flip() {
    const prevFrom = fromAsset;
    setFromAsset(toAsset);
    setToAsset(prevFrom);
    setFromInput('');
  }

  function useMax() {
    setFromInput(fromHeld ? fromHeld.toString() : '');
  }

  async function doSubmit() {
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api.swap({
        fromAsset: fromAsset.symbol,
        toAsset: toAsset.symbol,
        fromQty,
        fromCoingeckoId: fromAsset.id,
        toCoingeckoId: toAsset.id,
      });
      setStatus(res.message);
      setStatusOk(true);
      await Promise.all([refreshUser(), load()]);
      refresh();
      setSwapReceipt({
        heading: `Swap ${fromAsset.symbol} → ${toAsset.symbol}`,
        status: 'Successful',
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: 'You swapped', value: `${fromQty} ${fromAsset.symbol}` },
          { label: 'You received', value: `${res.toQty.toFixed(6)} ${toAsset.symbol}` },
        ],
        footerNote: 'Moved between your holdings — your NGN balance is unaffected.',
      });
      setFromInput('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!canSubmit) return;
    Alert.alert(
      'Confirm swap',
      `Swap ${fromQty} ${fromAsset.symbol} for ≈ ${toQty.toFixed(6)} ${toAsset.symbol}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: doSubmit },
      ],
    );
  }

  if (initialLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Swap" onBack={onBack} colors={colors} />
        <View style={styles.centerFill}>
          <BrandedLoader />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Swap" onBack={onBack} colors={colors} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.flabel}>YOU SWAP</Text>
            <Text style={styles.heldText}>Balance: {fromHeld.toFixed(6)} {fromAsset.symbol}</Text>
          </View>
          <View style={styles.assetRow}>
            <TouchableOpacity style={styles.assetPicker} onPress={() => setPickerFor('from')}>
              <IconBadge name={fromAsset.id} size={30} glyphSize={13} />
              <Text style={styles.assetSymbol}>{fromAsset.symbol}</Text>
              <Text style={styles.chevronDown}>▾</Text>
            </TouchableOpacity>
            <TextInput
              style={styles.amountInput}
              value={fromInput}
              onChangeText={setFromInput}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <TouchableOpacity style={styles.maxBtn} onPress={useMax}>
            <Text style={styles.maxBtnText}>Use Max</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.flipBtn} onPress={flip}>
          <Text style={styles.flipBtnText}>⇅</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.flabel}>YOU RECEIVE (ESTIMATED)</Text>
          <View style={styles.assetRow}>
            <TouchableOpacity style={styles.assetPicker} onPress={() => setPickerFor('to')}>
              <IconBadge name={toAsset.id} size={30} glyphSize={13} />
              <Text style={styles.assetSymbol}>{toAsset.symbol}</Text>
              <Text style={styles.chevronDown}>▾</Text>
            </TouchableOpacity>
            <Text style={styles.toAmount}>{toQty > 0 ? toQty.toFixed(6) : '0.00'}</Text>
          </View>
        </View>

        {fromPrice > 0 && toPrice > 0 && (
          <Text style={styles.rateNote}>
            1 {fromAsset.symbol} ≈ {(fromPrice / toPrice).toFixed(6)} {toAsset.symbol} · 1% swap fee included
          </Text>
        )}

        {overHeld && <Text style={styles.errorNote}>You only hold {fromHeld.toFixed(6)} {fromAsset.symbol}.</Text>}

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || submitting}>
          <Text style={styles.ctaText}>{submitting ? 'Swapping…' : 'Swap Now'}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Instant — swaps move between your holdings and settle immediately, no approval needed.</Text>
      </ScrollView>

      <AssetPickerModal
        visible={!!pickerFor}
        onClose={() => setPickerFor(null)}
        onSelect={a => (pickerFor === 'from' ? setFromAsset(a) : setToAsset(a))}
        colors={colors}
        excludeSymbol={pickerFor === 'from' ? toAsset.symbol : fromAsset.symbol}
        title={pickerFor === 'from' ? 'Swap from' : 'Swap to'}
      />

      <ReceiptModal receipt={swapReceipt} onClose={() => setSwapReceipt(null)} colors={colors} />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    flabel: { color: colors.muted, fontSize: 10.5, letterSpacing: 0.5 },
    heldText: { color: colors.muted, fontSize: 11 },
    assetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
    assetPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
    assetSymbol: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    chevronDown: { color: colors.muted, fontSize: 10 },
    amountInput: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'right', padding: 0 },
    toAmount: { flex: 1, color: colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'right' },
    maxBtn: { alignSelf: 'flex-end', marginTop: spacing.sm },
    maxBtnText: { color: colors.signal, fontSize: 11.5, fontWeight: '700' },
    flipBtn: { alignSelf: 'center', width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginVertical: -spacing.sm, zIndex: 1 },
    flipBtnText: { color: colors.signal, fontSize: 18, fontWeight: '700' },
    rateNote: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.lg },
    errorNote: { color: colors.ember, fontSize: 11.5, textAlign: 'center', marginTop: spacing.sm },
    status: { fontSize: 12, textAlign: 'center', marginTop: spacing.md },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.lg },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
