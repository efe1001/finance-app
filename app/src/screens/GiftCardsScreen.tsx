import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../currency/CurrencyContext';
import type { ScreenKey } from '../components/Drawer';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';

type Rate = { brand: string; ratePerDollar: number };

export default function GiftCardsScreen({
  onBack,
  onNavigate,
  colors,
}: {
  onBack: () => void;
  onNavigate: (key: ScreenKey) => void;
  colors: ThemeColors;
}) {
  const { user } = useAuth();
  const { formatNgn } = useCurrency();
  const styles = getStyles(colors);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [faceValue, setFaceValue] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [saleReceipt, setSaleReceipt] = useState<Receipt | null>(null);
  const hasPayoutAccount = !!user?.payoutAccountNumber;

  const loadRates = useCallback(async () => {
    setLoading(true);
    try {
      setRates(await api.giftCardRates());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const card = rates[selected];
  const payoutNgn = card ? (parseFloat(faceValue || '0') * card.ratePerDollar).toFixed(2) : '0';

  async function doSubmit() {
    if (!user || !card || !faceValue || !code) return;
    setStatus(null);
    try {
      const res = await api.submitGiftCard({ brand: card.brand, faceValueUsd: parseFloat(faceValue), code });
      setStatus(res.message);
      setStatusOk(true);
      setSaleReceipt({
        heading: `Sell ${card.brand} Gift Card`,
        status: 'Pending verification',
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: 'Card value', value: `$${faceValue}` },
          { label: 'You receive', value: formatNgn(Number(payoutNgn)) },
          { label: 'Card code', value: code },
          { label: 'Payout account', value: `${user.payoutBankName} · ${user.payoutAccountNumber}` },
          { label: 'Payout name', value: user.payoutAccountName || '' },
        ],
        footerNote: 'Payment is sent once our team verifies the code — usually within 15 minutes.',
      });
      setFaceValue('');
      setCode('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    }
  }

  function submit() {
    if (!user || !card || !faceValue || !code || !hasPayoutAccount) return;
    Alert.alert(
      'Confirm sale',
      `You're selling ${card.brand} worth $${faceValue} for ${formatNgn(Number(payoutNgn))}.\n\nOnce your code is verified, this will be paid to:\n${user.payoutBankName} · ${user.payoutAccountNumber}\n${user.payoutAccountName}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm & Submit', onPress: doSubmit },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gift Cards" onBack={onBack} colors={colors} right={<IconBadge name="giftcard" size={30} glyphSize={14} />} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadRates} tintColor={colors.signal} />}>
        <Text style={styles.listHead}>SELECT CARD</Text>
        <View style={styles.grid}>
          {rates.map((r, idx) => (
            <TouchableOpacity key={r.brand} style={[styles.tile, idx === selected && styles.tileOn]} onPress={() => setSelected(idx)}>
              <Text style={styles.tileName}>{r.brand}</Text>
              <Text style={styles.tileRate}>₦{r.ratePerDollar}/$1</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>CARD VALUE (USD)</Text>
          <TextInput style={styles.input} value={faceValue} onChangeText={setFaceValue} placeholder="100" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>YOU RECEIVE</Text>
          <Text style={styles.fval}>{formatNgn(Number(payoutNgn))}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>CARD CODE</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="XXXX-XXXX-XXXX" placeholderTextColor={colors.muted} />
        </View>

        {hasPayoutAccount ? (
          <View style={styles.payoutCard}>
            <Text style={styles.payoutLabel}>PAYS OUT TO</Text>
            <Text style={styles.payoutName}>{user?.payoutAccountName}</Text>
            <Text style={styles.payoutBank}>{user?.payoutBankName} · {user?.payoutAccountNumber}</Text>
            <TouchableOpacity onPress={() => onNavigate('payment')}>
              <Text style={styles.payoutChange}>Change payout account →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.payoutMissing} onPress={() => onNavigate('payment')}>
            <View style={{ flex: 1 }}>
              <Text style={styles.payoutMissingTitle}>Add your payout bank account</Text>
              <Text style={styles.payoutMissingText}>We need to know where to pay you before you can sell a gift card.</Text>
            </View>
            <Text style={styles.payoutMissingArrow}>→</Text>
          </TouchableOpacity>
        )}

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, (!faceValue || !code || !hasPayoutAccount) && { opacity: 0.5 }]} onPress={submit} disabled={!faceValue || !code || !hasPayoutAccount}>
          <Text style={styles.ctaText}>Submit for Verification</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Once your code is verified, payment is sent straight to your saved bank account — usually within 15 minutes.</Text>
      </ScrollView>
      <ReceiptModal receipt={saleReceipt} onClose={() => setSaleReceipt(null)} colors={colors} />
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    listHead: { color: colors.muted, fontSize: 12, letterSpacing: 0.5, marginBottom: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    tile: { width: '31%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center' },
    tileOn: { borderColor: colors.signal, backgroundColor: 'rgba(226,163,58,0.08)' },
    tileName: { color: colors.ink, fontSize: 12, fontWeight: '700' },
    tileRate: { color: colors.muted, fontSize: 10, marginTop: 3 },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    fval: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
    payoutCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    payoutLabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5, marginBottom: 2 },
    payoutName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    payoutBank: { color: colors.muted, fontSize: 12, marginTop: 2 },
    payoutChange: { color: colors.signal, fontSize: 11.5, fontWeight: '700', marginTop: spacing.sm },
    payoutMissing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: 'rgba(226,163,58,0.08)', borderWidth: 1, borderColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    payoutMissingTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    payoutMissingText: { color: colors.muted, fontSize: 11.5, marginTop: 2, lineHeight: 16 },
    payoutMissingArrow: { color: colors.signal, fontSize: 20, fontWeight: '700' },
  });
}
