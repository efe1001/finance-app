import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Clipboard } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

const ASSETS = [
  { id: 'bitcoin', symbol: 'BTC' },
  { id: 'ethereum', symbol: 'ETH' },
  { id: 'tether', symbol: 'USDT' },
  { id: 'usd-coin', symbol: 'USDC' },
  { id: 'binancecoin', symbol: 'BNB' },
  { id: 'solana', symbol: 'SOL' },
  { id: 'ripple', symbol: 'XRP' },
  { id: 'dogecoin', symbol: 'DOGE' },
];

export default function TradeScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [assetIdx, setAssetIdx] = useState(0);
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [platformWallets, setPlatformWallets] = useState<{ asset: string; address: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [amountUsd, setAmountUsd] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  // --- Quidax per-user deposit addresses: built and tested, but on hold until the
  // Quidax account is approved for business/merchant access (sub-accounts API is
  // gated behind that). Re-enable by swapping the platformWallets lookup below for
  // a call to api.quidax.depositAddress(asset.symbol) once that's unblocked.
  //
  // const [depositAddr, setDepositAddr] = useState<{ status: string; address: string | null }>({ status: 'loading', address: null });
  // const loadDepositAddress = useCallback(async () => {
  //   setDepositAddr({ status: 'loading', address: null });
  //   try {
  //     const res = await api.quidax.depositAddress(asset.symbol);
  //     setDepositAddr({ status: res.status, address: res.address });
  //   } catch (e) {
  //     setDepositAddr({ status: 'error', address: null });
  //   }
  // }, [asset.symbol]);
  // useEffect(() => { if (side === 'sell') loadDepositAddress(); }, [side, loadDepositAddress]);

  const asset = ASSETS[assetIdx];
  const priceUsd = prices[asset.id]?.usd ?? 0;
  const NGN_PER_USD = 1631;
  const priceNgn = priceUsd * NGN_PER_USD;
  const platformAddress = platformWallets.find(w => w.asset === asset.symbol)?.address || '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([
        api.cryptoPrices(ASSETS.map(a => a.id).join(',')),
        api.platformWallets().catch(() => []),
      ]);
      setPrices(p);
      setPlatformWallets(w);
    } catch (e) {
      // best-effort; keep last known prices
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const receiveNgn = (parseFloat(amountUsd || '0') * priceNgn).toFixed(2);
  const qty = priceUsd ? parseFloat(amountUsd || '0') / priceUsd : 0;
  const insufficientBalance = side === 'buy' && !!amountUsd && Number(receiveNgn) > (user?.walletBalanceNgn ?? 0);
  const canSubmit = side === 'buy' ? !!amountUsd && !!myAddress && !insufficientBalance : !!amountUsd;

  function copyAddress() {
    if (!platformAddress) return;
    Clipboard.setString(platformAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1800);
  }

  async function submitOrder() {
    if (!user || !canSubmit) return;
    setStatus(null);
    try {
      await api.addTransaction({
        type: 'crypto',
        title: `${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}`,
        subtitle:
          side === 'buy'
            ? `${qty.toFixed(6)} ${asset.symbol} → sent to ${myAddress}`
            : `${qty.toFixed(6)} ${asset.symbol} sent to our ${asset.symbol} address`,
        amountNgn: side === 'buy' ? -Number(receiveNgn) : Number(receiveNgn),
        address: side === 'buy' ? myAddress : platformAddress,
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        <View style={styles.seg}>
          <TouchableOpacity style={[styles.segItem, side === 'buy' && styles.segItemOn]} onPress={() => setSide('buy')}>
            <Text style={[styles.segText, side === 'buy' && styles.segTextOn]}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segItem, side === 'sell' && styles.segItemOn]} onPress={() => setSide('sell')}>
            <Text style={[styles.segText, side === 'sell' && styles.segTextOn]}>Sell</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetRow} contentContainerStyle={{ gap: spacing.sm }}>
          {ASSETS.map((a, idx) => (
            <TouchableOpacity key={a.id} style={[styles.assetChip, idx === assetIdx && styles.assetChipOn]} onPress={() => setAssetIdx(idx)}>
              <Text style={[styles.assetChipText, idx === assetIdx && styles.assetChipTextOn]}>{a.symbol}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
          <Text style={styles.flabel}>{side === 'buy' ? 'YOU RECEIVE' : 'YOU GET PAID'}</Text>
          <Text style={styles.fval}>
            {side === 'buy' ? `${qty.toFixed(6)} ${asset.symbol}` : `₦${Number(receiveNgn).toLocaleString()}`}
          </Text>
        </View>

        {side === 'buy' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOUR RECEIVING {asset.symbol} ADDRESS</Text>
              <TextInput style={styles.input} value={myAddress} onChangeText={setMyAddress} placeholder={`Paste your ${asset.symbol} address`} placeholderTextColor={colors.muted} autoCapitalize="none" />
            </View>
            {insufficientBalance && (
              <Text style={styles.insufficientText}>
                Insufficient balance — you have ₦{(user?.walletBalanceNgn ?? 0).toLocaleString()}, this order needs ₦{Number(receiveNgn).toLocaleString()}.
              </Text>
            )}
          </>
        ) : (
          <View style={styles.field}>
            <Text style={styles.flabel}>SEND {asset.symbol} TO THIS ADDRESS</Text>
            <View style={styles.addressRow}>
              <Text style={styles.addressText} selectable numberOfLines={1} ellipsizeMode="middle">
                {platformAddress || 'Not configured yet — contact support'}
              </Text>
              {!!platformAddress && (
                <TouchableOpacity style={styles.copyBtn} onPress={copyAddress}>
                  <Text style={styles.copyBtnText}>{addressCopied ? '✓ Copied' : 'Copy'}</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.fsub}>After sending, submit below so an admin can confirm and pay you out.</Text>
          </View>
        )}

        {status && <Text style={styles.status}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, !canSubmit && { opacity: 0.5 }]} onPress={submitOrder} disabled={!canSubmit}>
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
    assetRow: { flexDirection: 'row', marginBottom: spacing.lg, flexGrow: 0 },
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
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    addressText: { flex: 1, color: colors.signal, fontSize: 14, fontWeight: '700' },
    copyBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    copyBtnText: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    insufficientText: { color: colors.ember, fontSize: 12, marginTop: -spacing.xs, marginBottom: spacing.sm },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
