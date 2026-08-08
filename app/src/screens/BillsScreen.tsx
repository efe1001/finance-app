import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, RefreshControl } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../currency/CurrencyContext';
import { useRefresh } from '../data/RefreshContext';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';
import BrandedLoader from '../components/BrandedLoader';

type BillItem = { itemCode: string; billerCode: string; name: string; provider: string; amount: number; fee: number; labelName: string };
type Catalog = Record<string, Record<string, BillItem[]>>;

// Must match MARKUP_RATE in backend/src/routes/bills.js - the backend is the
// actual source of truth for what gets charged, this is only for showing the
// user the right total before they submit.
const MARKUP_RATE = 0.03;

const PROVIDER_ICON_KEYS: Record<string, string> = {
  MTN: 'mtn',
  AIRTEL: 'airtel',
  GLO: 'glo',
  '9MOBILE': '9mobile',
  DSTV: 'dstv',
  GOTV: 'gotv',
  STARTIMES: 'startimes',
  SMILE: 'smile',
  SPECTRANET: 'spectranet',
};

function providerIconKey(category: string, provider: string) {
  const known = PROVIDER_ICON_KEYS[provider.toUpperCase()];
  if (known) return known;
  if (category === 'Electricity') return 'electricity';
  if (category === 'Education') return 'education';
  return 'bills';
}

const CATEGORIES = [
  { label: 'Airtime', icon: 'airtime' },
  { label: 'Data', icon: 'data' },
  { label: 'Electricity', icon: 'electricity' },
  { label: 'Cable TV', icon: 'cableTv' },
  { label: 'Internet', icon: 'internet' },
  { label: 'Education', icon: 'education' },
  { label: 'Betting', icon: 'betting' },
  { label: 'Insurance', icon: 'insurance' },
];
const COMING_SOON = new Set(['Betting', 'Insurance']);

export default function BillsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { refreshUser } = useAuth();
  const { formatNgn } = useCurrency();
  const { refresh } = useRefresh();
  const styles = getStyles(colors);

  const [catalog, setCatalog] = useState<Catalog>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [category, setCategory] = useState('Airtime');
  const [provider, setProvider] = useState<string | null>(null);
  const [item, setItem] = useState<BillItem | null>(null);
  const [customerNumber, setCustomerNumber] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payReceipt, setPayReceipt] = useState<Receipt | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCatalog(await api.bills.categories());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function pickCategory(c: string) {
    setCategory(c);
    setProvider(null);
    setItem(null);
    setCustomerNumber('');
    setAmountInput('');
    setStatus(null);
  }

  function pickProvider(p: string) {
    setProvider(p);
    setStatus(null);
    const items = catalog[category]?.[p] ?? [];
    // Airtime/Electricity/Education providers usually resolve to exactly one
    // purchasable item (the network itself, or Prepaid vs the lone Postpaid
    // option) - skip straight to the form instead of a pointless single-item list.
    setItem(items.length === 1 ? items[0] : null);
    setAmountInput('');
  }

  const providers = provider === null ? Object.keys(catalog[category] ?? {}).sort() : [];
  const itemsForProvider = provider ? (catalog[category]?.[provider] ?? []) : [];
  const isVariableAmount = item?.amount === 0;
  const billAmount = item ? (isVariableAmount ? Number(amountInput || '0') : item.amount) : 0;
  const markup = item ? Math.ceil(billAmount * MARKUP_RATE) : 0;
  const totalNgn = item ? billAmount + item.fee + markup : 0;
  const canSubmit = !!item && !!customerNumber && billAmount > 0;

  async function doSubmit() {
    if (!item || !canSubmit) return;
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api.bills.pay({
        itemCode: item.itemCode,
        customerNumber,
        amount: isVariableAmount ? billAmount : undefined,
      });
      setStatus(res.message);
      setStatusOk(true);
      await refreshUser();
      refresh();
      setPayReceipt({
        heading: item.name,
        status: res.status,
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: item.labelName, value: customerNumber },
          { label: 'Amount', value: formatNgn(billAmount) },
          ...(item.fee > 0 ? [{ label: 'Provider Fee', value: formatNgn(item.fee) }] : []),
          { label: 'Service Fee', value: formatNgn(markup) },
          { label: 'Total', value: formatNgn(totalNgn) },
        ],
        footerNote: res.status === 'Pending' ? 'This may take a few minutes to complete.' : 'Purchase complete.',
      });
      setCustomerNumber('');
      setAmountInput('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!item || !canSubmit) return;
    Alert.alert(
      `Confirm ${item.name}`,
      `Pay ${formatNgn(totalNgn)} for ${customerNumber}?\n\nBill payments can't be reversed once submitted — double-check the number above.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm & Pay', onPress: doSubmit },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Bills & Recharge" onBack={onBack} colors={colors} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {loadError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>Couldn't load billers. Pull down to try again.</Text>
          </View>
        )}

        <View style={styles.grid}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.label} style={styles.tile} onPress={() => pickCategory(c.label)}>
              <View style={[styles.tileBadgeWrap, category === c.label && { borderColor: colors.signal }]}>
                <IconBadge name={c.icon} size={44} />
              </View>
              <Text style={[styles.tileLabel, category === c.label && { color: colors.ink }]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !loadError ? (
          <View style={{ marginTop: spacing.xl }}><BrandedLoader /></View>
        ) : COMING_SOON.has(category) ? (
          <Text style={styles.empty}>{category} isn't available yet — check back soon.</Text>
        ) : !provider ? (
          <>
            <Text style={styles.listHead}>SELECT PROVIDER</Text>
            {providers.length === 0 ? (
              <Text style={styles.empty}>No {category.toLowerCase()} billers available right now.</Text>
            ) : (
              <View style={styles.providerGrid}>
                {providers.map(p => (
                  <TouchableOpacity key={p} style={styles.providerTile} onPress={() => pickProvider(p)}>
                    <IconBadge name={providerIconKey(category, p)} size={40} />
                    <Text style={styles.providerTileText} numberOfLines={1}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => { setProvider(null); setItem(null); }}>
              <Text style={styles.changeProvider}>← {provider}, change provider</Text>
            </TouchableOpacity>

            {!item ? (
              <>
                <Text style={styles.listHead}>SELECT PLAN</Text>
                {itemsForProvider.map(i => (
                  <TouchableOpacity key={i.itemCode} style={styles.bundleRow} onPress={() => setItem(i)}>
                    <Text style={styles.bundleName}>{i.name}</Text>
                    <Text style={styles.bundlePrice}>{i.amount > 0 ? formatNgn(i.amount) : 'Enter amount'}</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.flabel}>{item.name.toUpperCase()}</Text>
                  {itemsForProvider.length > 1 && (
                    <TouchableOpacity onPress={() => setItem(null)}>
                      <Text style={styles.changePlan}>Change plan</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.flabel}>{item.labelName.toUpperCase()}</Text>
                  <TextInput
                    style={styles.input}
                    value={customerNumber}
                    onChangeText={setCustomerNumber}
                    placeholder="Enter details"
                    placeholderTextColor={colors.muted}
                    keyboardType={/number/i.test(item.labelName) ? 'number-pad' : 'default'}
                  />
                </View>

                {isVariableAmount ? (
                  <View style={styles.field}>
                    <Text style={styles.flabel}>AMOUNT (₦)</Text>
                    <TextInput
                      style={styles.input}
                      value={amountInput}
                      onChangeText={setAmountInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.muted}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ) : (
                  <View style={styles.field}>
                    <Text style={styles.flabel}>AMOUNT</Text>
                    <Text style={styles.fval}>{formatNgn(item.amount)}</Text>
                  </View>
                )}

                {billAmount > 0 && (
                  <Text style={styles.feeNote}>
                    {item.fee > 0 ? `+ ${formatNgn(item.fee)} provider fee ` : ''}
                    + {formatNgn(markup)} service fee · total {formatNgn(totalNgn)}
                  </Text>
                )}

                {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

                <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || submitting}>
                  <Text style={styles.ctaText}>{submitting ? 'Processing…' : `Pay ${formatNgn(totalNgn)}`}</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
      <ReceiptModal receipt={payReceipt} onClose={() => setPayReceipt(null)} colors={colors} />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    errorBanner: { backgroundColor: 'rgba(226,96,77,0.1)', borderWidth: 1, borderColor: colors.ember, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
    errorBannerText: { color: colors.ember, fontSize: 11.5, lineHeight: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
    tile: { width: '22%', alignItems: 'center', gap: spacing.xs },
    tileBadgeWrap: { borderRadius: 26, borderWidth: 2, borderColor: 'transparent', padding: 2 },
    tileLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
    listHead: { color: colors.muted, fontSize: 12, letterSpacing: 0.5, marginBottom: spacing.sm },
    empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
    providerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    providerTile: { width: '31%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.xs, alignItems: 'center', gap: spacing.sm },
    providerTileText: { color: colors.ink, fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
    changeProvider: { color: colors.signal, fontSize: 12.5, fontWeight: '700', marginBottom: spacing.lg },
    bundleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
    bundleName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600', marginRight: spacing.sm },
    bundlePrice: { color: colors.signal, fontSize: 13, fontWeight: '700' },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    fval: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    changePlan: { color: colors.signal, fontSize: 11.5, fontWeight: '700', marginTop: spacing.xs },
    feeNote: { color: colors.muted, fontSize: 11, marginBottom: spacing.sm, textAlign: 'right' },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
  });
}
