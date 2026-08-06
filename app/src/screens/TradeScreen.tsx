import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

const ASSETS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'tether', symbol: 'USDT' },
];

type AddressState = { status: 'loading' | 'ready' | 'pending' | 'error'; address: string | null };

export default function TradeScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [assetIdx, setAssetIdx] = useState(0);
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [loading, setLoading] = useState(false);
  const [amountUsd, setAmountUsd] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [depositAddr, setDepositAddr] = useState<AddressState>({ status: 'loading', address: null });

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

  const loadDepositAddress = useCallback(async () => {
    setDepositAddr({ status: 'loading', address: null });
    try {
      const res = await api.quidax.depositAddress(asset.symbol);
      setDepositAddr({ status: res.status, address: res.address });
    } catch (e) {
      setDepositAddr({ status: 'error', address: null });
    }
  }, [asset.symbol]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  useEffect(() => {
    if (side === 'sell') loadDepositAddress();
  }, [side, loadDepositAddress]);

  const receiveNgn = (parseFloat(amountUsd || '0') * priceNgn).toFixed(2);
  const qty = priceUsd ? parseFloat(amountUsd || '0') / priceUsd : 0;
  const canSubmit = !!amountUsd && !!myAddress;

  async function submitBuyOrder() {
    if (!user || !canSubmit) return;
    setStatus(null);
    try {
      await api.addTransaction({
        type: 'crypto',
        title: `Buy ${asset.symbol}`,
        subtitle: `${qty.toFixed(6)} ${asset.symbol} → sent to ${myAddress}`,
        amountNgn: -Number(receiveNgn),
        address: myAddress,
        asset: asset.symbol,
        qty,
      });
      await refreshUser();
      setStatus('Order submitted — awaiting admin confirmation.');
      setAmountUsd('');
      setMyAddress('');
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Trade" onBack={onBack} colors={colors} />
      <ScrollView
        style={{ flex: 1 }}
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

        {side === 'buy' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOU PAY (USD)</Text>
              <TextInput style={styles.input} value={amountUsd} onChangeText={setAmountUsd} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
            </View>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOU RECEIVE</Text>
              <Text style={styles.fval}>{qty.toFixed(6)} {asset.symbol}</Text>
            </View>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOUR RECEIVING {asset.symbol} ADDRESS</Text>
              <TextInput style={styles.input} value={myAddress} onChangeText={setMyAddress} placeholder={`Paste your ${asset.symbol} address`} placeholderTextColor={colors.muted} autoCapitalize="none" />
            </View>

            {status && <Text style={styles.status}>{status}</Text>}

            <TouchableOpacity style={[styles.cta, !canSubmit && { opacity: 0.5 }]} onPress={submitBuyOrder} disabled={!canSubmit}>
              <Text style={styles.ctaText}>Submit Buy Order</Text>
            </TouchableOpacity>
            <Text style={styles.trustNote}>Live prices from CoinGecko. An admin manually confirms and sends every buy order.</Text>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOUR PERSONAL {asset.symbol} DEPOSIT ADDRESS</Text>
              {depositAddr.status === 'loading' && (
                <View style={styles.addrRow}>
                  <ActivityIndicator size="small" color={colors.signal} />
                  <Text style={styles.fsub}>Loading your address…</Text>
                </View>
              )}
              {depositAddr.status === 'pending' && (
                <>
                  <Text style={styles.fsub}>Generating your unique {asset.symbol} address — this can take a few seconds.</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={loadDepositAddress}>
                    <Text style={styles.retryBtnText}>Check Again</Text>
                  </TouchableOpacity>
                </>
              )}
              {depositAddr.status === 'error' && (
                <>
                  <Text style={[styles.fsub, { color: colors.ember }]}>Could not load your address.</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={loadDepositAddress}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </>
              )}
              {depositAddr.status === 'ready' && depositAddr.address && (
                <>
                  <Text style={styles.addressText} selectable>{depositAddr.address}</Text>
                  <Text style={styles.fsub}>
                    This address belongs only to you. Send any amount of {asset.symbol} here — once it's confirmed on-chain it
                    lands automatically in your pending transactions for admin approval, no extra steps needed.
                  </Text>
                </>
              )}
            </View>

            <View style={styles.field}>
              <Text style={styles.flabel}>PREVIEW: SELL VALUE (USD)</Text>
              <TextInput style={styles.input} value={amountUsd} onChangeText={setAmountUsd} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
              <Text style={styles.fsub}>Estimate only — {qty.toFixed(6)} {asset.symbol} ≈ ₦{Number(receiveNgn).toLocaleString()}</Text>
            </View>

            <Text style={styles.trustNote}>Deposits are detected automatically by Quidax. An admin still reviews and approves the payout.</Text>
          </>
        )}
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
    fsub: { color: colors.muted, fontSize: 10.5, marginTop: spacing.sm, lineHeight: 15 },
    input: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs, padding: 0 },
    addressText: { color: colors.signal, fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
    addrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    retryBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    retryBtnText: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
