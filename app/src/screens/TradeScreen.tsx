import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

const ASSETS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'tether', symbol: 'USDT' },
];

export default function TradeScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [assetIdx, setAssetIdx] = useState(0);
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [loading, setLoading] = useState(false);
  const [amountUsd, setAmountUsd] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const asset = ASSETS[assetIdx];
  const priceUsd = prices[asset.id]?.usd ?? 0;
  const NGN_PER_USD = 1631;
  const priceNgn = priceUsd * NGN_PER_USD;

  const loadPrices = useCallback(async () => {
    setLoading(true);
    try {
      setPrices(await api.cryptoPrices(ASSETS.map(a => a.id).join(',')));
    } catch (e) {
      // best-effort; keep last known prices
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const receiveNgn = (parseFloat(amountUsd || '0') * priceNgn).toFixed(2);

  async function submitOrder() {
    if (!user || !amountUsd || !address) return;
    setStatus(null);
    try {
      await api.addTransaction({
        type: 'crypto',
        title: `${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}`,
        subtitle: `~$${amountUsd} · ${side === 'buy' ? 'send to' : 'received from'} ${address}`,
        amountNgn: side === 'buy' ? -Number(receiveNgn) : Number(receiveNgn),
        address,
      });
      await refreshUser();
      setStatus('Order submitted — awaiting admin confirmation.');
      setAmountUsd('');
      setAddress('');
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Trade" onBack={onBack} colors={colors} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadPrices} tintColor={colors.signal} />}>
        <View style={styles.seg}>
          <TouchableOpacity style={[styles.segItem, side === 'buy' && styles.segItemOn]} onPress={() => setSide('buy')}>
            <Text style={[styles.segText, side === 'buy' && styles.segTextOn]}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segItem, side === 'sell' && styles.segItemOn]} onPress={() => setSide('sell')}>
            <Text style={[styles.segText, side === 'sell' && styles.segTextOn]}>Sell</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.assetRow}>
          {ASSETS.map((a, idx) => (
            <TouchableOpacity key={a.id} style={[styles.assetChip, idx === assetIdx && styles.assetChipOn]} onPress={() => setAssetIdx(idx)}>
              <Text style={[styles.assetChipText, idx === assetIdx && styles.assetChipTextOn]}>{a.symbol}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>{asset.symbol} / NGN</Text>
          <Text style={styles.price}>
            {priceNgn ? `₦${priceNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'Loading…'}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>YOU {side === 'buy' ? 'PAY (USD)' : 'SELL (USD VALUE)'}</Text>
          <TextInput style={styles.input} value={amountUsd} onChangeText={setAmountUsd} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>YOU RECEIVE</Text>
          <Text style={styles.fval}>₦{Number(receiveNgn).toLocaleString()}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>{side === 'buy' ? 'YOUR RECEIVING WALLET ADDRESS' : 'WALLET ADDRESS YOU SENT FROM'}</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder={`${asset.symbol} address`} placeholderTextColor={colors.muted} autoCapitalize="none" />
        </View>

        {status && <Text style={styles.status}>{status}</Text>}

        <TouchableOpacity style={styles.cta} onPress={submitOrder} disabled={!amountUsd || !address}>
          <Text style={styles.ctaText}>Submit {side === 'buy' ? 'Buy' : 'Sell'} Order</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Live prices from CoinGecko. An admin manually confirms and completes every trade.</Text>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, padding: 4, marginBottom: spacing.lg },
    segItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
    segItemOn: { backgroundColor: colors.signal },
    segText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    segTextOn: { color: colors.signalInk },
    assetRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    assetChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    assetChipOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    assetChipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
    assetChipTextOn: { color: colors.signalInk },
    priceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
    priceLabel: { color: colors.muted, fontSize: 12 },
    price: { color: colors.ink, fontSize: 28, fontWeight: '700', marginTop: spacing.sm },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    fval: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
    input: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs, padding: 0 },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
