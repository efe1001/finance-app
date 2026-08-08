import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Clipboard, Alert } from 'react-native';
import { pick, isErrorWithCode, errorCodes, types as pickerTypes, DocumentPickerResponse } from '@react-native-documents/picker';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../currency/CurrencyContext';
import type { ScreenKey } from '../components/Drawer';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';
import BrandedLoader from '../components/BrandedLoader';
import AssetPickerModal, { PickedAsset } from '../components/AssetPickerModal';
import { useRefresh } from '../data/RefreshContext';
import { readFileAsBase64 } from '../utils/fileToBase64';

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const NGN_PER_USD = 1631;

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

export default function TradeScreen({
  onBack,
  onNavigate,
  colors,
}: {
  onBack: () => void;
  onNavigate: (key: ScreenKey) => void;
  colors: ThemeColors;
}) {
  const { user, refreshUser } = useAuth();
  const { refresh } = useRefresh();
  const { currency, fromUsd, toUsd, fromNgn, format, formatNgn } = useCurrency();
  const styles = getStyles(colors);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [asset, setAsset] = useState<PickedAsset>(ASSETS[0]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, { usd: number }>>({});
  const [holdings, setHoldings] = useState<Record<string, number>>({});
  const [platformWallets, setPlatformWallets] = useState<{ asset: string; address: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [inputMode, setInputMode] = useState<'currency' | 'crypto'>('currency');
  const [inputValue, setInputValue] = useState('');
  const [myAddress, setMyAddress] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [receipt, setReceipt] = useState<DocumentPickerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orderReceipt, setOrderReceipt] = useState<Receipt | null>(null);

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

  const priceUsd = prices[asset.id]?.usd ?? 0;
  const priceNgn = priceUsd * NGN_PER_USD;
  const heldQty = holdings[asset.symbol] ?? 0;
  const platformAddress = platformWallets.find(w => w.asset === asset.symbol)?.address || '';
  const depositSymbols = new Set(platformWallets.filter(w => w.address).map(w => w.asset));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, h] = await Promise.all([
        api.cryptoPrices(ASSETS.map(a => a.id).join(',')),
        api.platformWallets().catch(() => []),
        api.holdings().catch(() => []),
      ]);
      setPrices(p);
      setPlatformWallets(w);
      const map: Record<string, number> = {};
      (h as { asset: string; amount: number }[]).forEach(x => (map[x.asset] = Number(x.amount)));
      setHoldings(map);
      setLoadError(false);
    } catch (e) {
      // keep last known prices, but flag it so the user knows this isn't just "nothing here"
      setLoadError(true);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Prices are preloaded for the 8 starter assets only - picking anything else
  // via the search picker needs its own one-off price fetch.
  useEffect(() => {
    if (prices[asset.id]) return;
    api.cryptoPrices(asset.id).then(p => setPrices(prev => ({ ...prev, ...p }))).catch(() => {});
  }, [asset.id, prices]);

  // A qty typed in one asset/mode doesn't carry meaning after switching either,
  // so start fresh rather than leave a stale, misleading number in the field.
  useEffect(() => {
    setInputValue('');
  }, [asset.id, side]);

  // The crypto quantity being traded — the single source of truth everything
  // else (NGN amount, previews, limits) derives from, regardless of which unit
  // the user is typing in.
  const qty = (() => {
    const n = parseFloat(inputValue || '0');
    if (!n) return 0;
    if (inputMode === 'crypto') return n;
    return priceUsd ? toUsd(n) / priceUsd : 0;
  })();
  const amountNgn = qty * priceNgn;

  const insufficientBalance = side === 'buy' && qty > 0 && amountNgn > (user?.walletBalanceNgn ?? 0);
  const lowHoldings = side === 'sell' && qty > 0 && qty > heldQty;
  const canSubmit = side === 'buy' ? qty > 0 && !!myAddress && !insufficientBalance : qty > 0;

  function switchMode(mode: 'currency' | 'crypto') {
    if (mode === inputMode) return;
    if (qty > 0) {
      setInputValue(mode === 'crypto' ? qty.toFixed(8) : fromUsd(qty * priceUsd).toFixed(2));
    }
    setInputMode(mode);
  }

  function useMax() {
    if (side === 'buy') {
      const maxQty = priceNgn > 0 ? (user?.walletBalanceNgn ?? 0) / priceNgn : 0;
      setInputValue(inputMode === 'crypto' ? maxQty.toFixed(8) : fromNgn(user?.walletBalanceNgn ?? 0).toFixed(2));
    } else {
      setInputValue(inputMode === 'crypto' ? heldQty.toString() : fromUsd(heldQty * priceUsd).toFixed(2));
    }
  }

  function copyAddress() {
    if (!platformAddress) return;
    Clipboard.setString(platformAddress);
    setAddressCopied(true);
    setTimeout(() => setAddressCopied(false), 1800);
  }

  async function pickReceipt() {
    try {
      const [res] = await pick({ type: [pickerTypes.allFiles] });
      if ((res.size ?? 0) > MAX_RECEIPT_BYTES) {
        Alert.alert('File too large', 'Please attach a file under 5MB.');
        return;
      }
      setReceipt(res);
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
        Alert.alert('Error', 'Could not select that file.');
      }
    }
  }

  async function doSubmitOrder() {
    if (!user || !canSubmit) return;
    setStatus(null);
    setSubmitting(true);
    try {
      let receiptData: string | undefined;
      if (side === 'sell' && receipt) {
        receiptData = await readFileAsBase64(receipt.uri);
      }

      await api.addTransaction({
        type: 'crypto',
        title: `${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}`,
        subtitle:
          side === 'buy'
            ? `${qty.toFixed(6)} ${asset.symbol} → sent to ${myAddress}`
            : `${qty.toFixed(6)} ${asset.symbol} sent to our ${asset.symbol} address`,
        amountNgn: side === 'buy' ? -amountNgn : amountNgn,
        address: side === 'buy' ? myAddress : platformAddress,
        asset: asset.symbol,
        coingeckoId: asset.id,
        qty,
        receiptData,
        receiptMime: receipt?.type ?? undefined,
        receiptFilename: receipt?.name ?? undefined,
      });
      await Promise.all([refreshUser(), load()]);
      refresh();
      setStatus('Order submitted — awaiting admin confirmation.');
      setStatusOk(true);
      setOrderReceipt({
        heading: `${side === 'buy' ? 'Buy' : 'Sell'} ${asset.symbol}`,
        status: 'Pending admin confirmation',
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: 'Amount', value: formatNgn(amountNgn) },
          { label: 'Quantity', value: `${qty.toFixed(6)} ${asset.symbol}` },
          { label: 'Price', value: `${format(priceUsd, { maximumFractionDigits: priceUsd > 100 ? 0 : 2 })} / ${asset.symbol}` },
          side === 'buy'
            ? { label: 'Sent to your address', value: myAddress }
            : { label: 'Sent to our address', value: platformAddress },
        ],
        footerNote: 'An admin manually confirms every trade. This receipt is proof of submission, not settlement.',
      });
      setReceipt(null);
      setInputValue('');
      setMyAddress('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submitOrder() {
    if (!user || !canSubmit) return;
    const verb = side === 'buy' ? 'Buy' : 'Sell';
    const detail =
      side === 'buy'
        ? `You'll pay ${formatNgn(amountNgn)} for ${qty.toFixed(6)} ${asset.symbol}, sent to ${myAddress}.`
        : `You're sending ${qty.toFixed(6)} ${asset.symbol} and will be paid ${formatNgn(amountNgn)} once confirmed.`;
    Alert.alert(`Confirm ${verb} Order`, detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: doSubmitOrder },
    ]);
  }

  if (initialLoading) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Trade" onBack={onBack} colors={colors} />
        <View style={styles.centerFill}>
          <BrandedLoader />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Trade" onBack={onBack} colors={colors} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>Couldn't refresh prices — showing the last known values. Pull down to retry.</Text>
          </View>
        )}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
          <Text style={styles.balanceAmount}>{formatNgn(user?.walletBalanceNgn ?? 0)}</Text>
          <Text style={styles.balanceHint}>Your crypto — tap one to trade it</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {ASSETS.map(a => {
              const qtyHeld = holdings[a.symbol] ?? 0;
              const valueUsd = qtyHeld * (prices[a.id]?.usd ?? 0);
              return (
                <TouchableOpacity key={a.id} style={[styles.holdingChip, a.id === asset.id && styles.holdingChipOn]} onPress={() => setAsset(a)}>
                  <IconBadge name={a.id} size={26} glyphSize={13} />
                  <View>
                    <Text style={styles.holdingSymbol}>{a.symbol}</Text>
                    <Text style={styles.holdingValue}>{qtyHeld > 0 ? format(valueUsd) : '—'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.seg}>
          <TouchableOpacity style={[styles.segItem, side === 'buy' && styles.segItemOn]} onPress={() => setSide('buy')}>
            <Text style={[styles.segText, side === 'buy' && styles.segTextOn]}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segItem, side === 'sell' && styles.segItemOn]} onPress={() => setSide('sell')}>
            <Text style={[styles.segText, side === 'sell' && styles.segTextOn]}>Sell</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assetRow} contentContainerStyle={{ gap: spacing.sm }}>
          {ASSETS.map(a => (
            <TouchableOpacity key={a.id} style={[styles.assetChip, a.id === asset.id && styles.assetChipOn]} onPress={() => setAsset(a)}>
              <Text style={[styles.assetChipText, a.id === asset.id && styles.assetChipTextOn]}>{a.symbol}</Text>
              {(holdings[a.symbol] ?? 0) > 0 && (
                <Text style={styles.ownedCheck} accessibilityLabel="You own this asset">✓</Text>
              )}
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.assetChip, !ASSETS.some(a => a.id === asset.id) && styles.assetChipOn]}
            onPress={() => setPickerOpen(true)}>
            <Text style={[styles.assetChipText, !ASSETS.some(a => a.id === asset.id) && styles.assetChipTextOn]}>
              {ASSETS.some(a => a.id === asset.id) ? '🔍 More coins' : `🔍 ${asset.symbol}`}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>{asset.symbol} / {currency}</Text>
          <Text style={styles.price}>{priceUsd ? format(priceUsd, { maximumFractionDigits: priceUsd > 100 ? 0 : 2 }) : 'Loading…'}</Text>
          {side === 'sell' && <Text style={styles.priceSub}>You hold {heldQty.toFixed(6)} {asset.symbol}</Text>}
        </View>

        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.flabel}>YOU {side === 'buy' ? 'PAY' : 'SELL'}</Text>
            <View style={styles.modeSeg}>
              <TouchableOpacity style={[styles.modeChip, inputMode === 'currency' && styles.modeChipOn]} onPress={() => switchMode('currency')}>
                <Text style={[styles.modeChipText, inputMode === 'currency' && styles.modeChipTextOn]}>{currency}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeChip, inputMode === 'crypto' && styles.modeChipOn]} onPress={() => switchMode('crypto')}>
                <Text style={[styles.modeChipText, inputMode === 'crypto' && styles.modeChipTextOn]}>{asset.symbol}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.maxBtn} onPress={useMax}>
              <Text style={styles.maxBtnText}>Max</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>{side === 'buy' ? 'YOU RECEIVE' : 'YOU GET PAID'}</Text>
          <Text style={styles.fval}>
            {inputMode === 'currency' ? `${qty.toFixed(6)} ${asset.symbol}` : formatNgn(amountNgn)}
          </Text>
          {inputMode === 'crypto' && <Text style={styles.fsub}>{qty.toFixed(6)} {asset.symbol}</Text>}
        </View>

        {side === 'buy' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.flabel}>YOUR RECEIVING {asset.symbol} ADDRESS</Text>
              <TextInput style={styles.input} value={myAddress} onChangeText={setMyAddress} placeholder={`Paste your ${asset.symbol} address`} placeholderTextColor={colors.muted} autoCapitalize="none" />
            </View>
            {insufficientBalance && (
              <View style={styles.insufficientBox}>
                <Text style={styles.insufficientTitle}>Insufficient balance</Text>
                <Text style={styles.insufficientText}>
                  You have {formatNgn(user?.walletBalanceNgn ?? 0)}, this order needs {formatNgn(amountNgn)}. Please top up to continue.
                </Text>
                <TouchableOpacity style={styles.topUpBtn} onPress={() => onNavigate('deposit')}>
                  <Text style={styles.topUpBtnText}>Top Up →</Text>
                </TouchableOpacity>
              </View>
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
            {lowHoldings && (
              <Text style={styles.holdingsNote}>
                You only have {heldQty.toFixed(6)} {asset.symbol} on record here — that's fine if you're sending from elsewhere.
              </Text>
            )}
          </View>
        )}

        {side === 'sell' && (
          <View style={styles.field}>
            <Text style={styles.flabel}>SEND RECEIPT (OPTIONAL)</Text>
            {receipt ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptName} numberOfLines={1}>{receipt.name}</Text>
                <TouchableOpacity onPress={() => setReceipt(null)}>
                  <Text style={styles.receiptRemove}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.attachBtn} onPress={pickReceipt}>
                <Text style={styles.attachBtnText}>📎 Attach photo, PDF, or file</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.fsub}>Proof of your send — a screenshot, PDF, or any file. Not required.</Text>
          </View>
        )}

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submitOrder} disabled={!canSubmit || submitting}>
          <Text style={styles.ctaText}>{submitting ? 'Submitting…' : `Submit ${side === 'buy' ? 'Buy' : 'Sell'} Order`}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Live prices from CoinGecko. An admin manually confirms and completes every trade.</Text>
      </ScrollView>
      <ReceiptModal receipt={orderReceipt} onClose={() => setOrderReceipt(null)} colors={colors} />
      <AssetPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={setAsset}
        colors={colors}
        depositSymbols={depositSymbols}
        title={`Select asset to ${side}`}
      />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    balanceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
    balanceLabel: { color: colors.muted, fontSize: 10.5, letterSpacing: 1 },
    balanceAmount: { color: colors.ink, fontSize: 24, fontWeight: '700', marginTop: spacing.xs },
    balanceHint: { color: colors.muted, fontSize: 10.5, marginTop: spacing.md, marginBottom: spacing.sm },
    holdingChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.surface2, borderRadius: radius.pill, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: 'transparent' },
    holdingChipOn: { borderColor: colors.signal },
    holdingSymbol: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
    holdingValue: { color: colors.muted, fontSize: 9.5, marginTop: 1 },
    seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm, padding: 4, marginBottom: spacing.lg },
    segItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
    segItemOn: { backgroundColor: colors.signal },
    segText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    segTextOn: { color: colors.signalInk },
    assetRow: { flexDirection: 'row', marginBottom: spacing.lg, flexGrow: 0 },
    assetChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    assetChipOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    assetChipText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
    assetChipTextOn: { color: colors.signalInk },
    ownedCheck: { color: colors.jade, fontSize: 10, fontWeight: '700' },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorBanner: { backgroundColor: 'rgba(226,96,77,0.1)', borderWidth: 1, borderColor: colors.ember, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
    errorBannerText: { color: colors.ember, fontSize: 11.5, lineHeight: 16 },
    priceCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl, marginBottom: spacing.lg },
    priceLabel: { color: colors.muted, fontSize: 12 },
    price: { color: colors.ink, fontSize: 28, fontWeight: '700', marginTop: spacing.sm },
    priceSub: { color: colors.muted, fontSize: 11, marginTop: spacing.sm },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    modeSeg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 2, gap: 2 },
    modeChip: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
    modeChipOn: { backgroundColor: colors.signal },
    modeChipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    modeChipTextOn: { color: colors.signalInk },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    fval: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
    fsub: { color: colors.muted, fontSize: 10.5, marginTop: spacing.sm, lineHeight: 15 },
    input: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs, padding: 0 },
    maxBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    maxBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    addressText: { flex: 1, color: colors.signal, fontSize: 14, fontWeight: '700' },
    copyBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    copyBtnText: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    insufficientBox: { backgroundColor: 'rgba(226,96,77,0.1)', borderWidth: 1, borderColor: colors.ember, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    insufficientTitle: { color: colors.ember, fontSize: 13, fontWeight: '700', marginBottom: 2 },
    insufficientText: { color: colors.ember, fontSize: 12, lineHeight: 17 },
    topUpBtn: { alignSelf: 'flex-start', marginTop: spacing.sm, backgroundColor: colors.ember, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
    topUpBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    holdingsNote: { color: colors.signal, fontSize: 10.5, marginTop: spacing.sm, lineHeight: 15 },
    attachBtn: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
    attachBtnText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    receiptRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: radius.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.xs },
    receiptName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600', marginRight: spacing.sm },
    receiptRemove: { color: colors.ember, fontSize: 12, fontWeight: '700' },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
