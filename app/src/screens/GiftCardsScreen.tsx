import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Alert, Image } from 'react-native';
import { pick, isErrorWithCode, errorCodes, types as pickerTypes, DocumentPickerResponse } from '@react-native-documents/picker';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency, NGN_PER_USD } from '../currency/CurrencyContext';
import type { ScreenKey } from '../components/Drawer';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function readFileAsBase64(uri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fetch(uri)
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] ?? '');
        };
        reader.readAsDataURL(blob);
      })
      .catch(reject);
  });
}

type Tier = { id: number; minUsd: number; maxUsd: number | null; percentage: number };
type Rate = { brand: string; tiers: Tier[] };

function tierLabel(t: Tier) {
  const range = t.maxUsd == null ? `$${t.minUsd}+` : `$${t.minUsd}–${t.maxUsd}`;
  return `${range}: ${t.percentage}%`;
}

function findTier(tiers: Tier[], faceValueUsd: number): Tier | null {
  const matches = tiers.filter(t => faceValueUsd >= t.minUsd && (t.maxUsd == null || faceValueUsd <= t.maxUsd));
  if (!matches.length) return null;
  return matches.reduce((best, t) => (t.minUsd > best.minUsd ? t : best), matches[0]);
}

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
  const [codeMode, setCodeMode] = useState<'type' | 'photo'>('type');
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<DocumentPickerResponse | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
  const faceValueNum = parseFloat(faceValue || '0');
  const tier = card ? findTier(card.tiers, faceValueNum) : null;
  const payoutNgn = tier ? faceValueNum * NGN_PER_USD * (tier.percentage / 100) : 0;
  const hasCode = codeMode === 'type' ? !!code : !!photo;
  const canSubmit = !!card && !!tier && faceValueNum > 0 && hasCode && hasPayoutAccount;

  async function pickPhoto() {
    try {
      const [res] = await pick({ type: [pickerTypes.images] });
      if ((res.size ?? 0) > MAX_IMAGE_BYTES) {
        Alert.alert('Photo too large', 'Please attach a photo under 5MB.');
        return;
      }
      setPhoto(res);
    } catch (e) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
        Alert.alert('Error', 'Could not select that photo.');
      }
    }
  }

  async function doSubmit() {
    if (!user || !card || !tier || !canSubmit) return;
    setStatus(null);
    setSubmitting(true);
    try {
      let receiptData: string | undefined;
      if (codeMode === 'photo' && photo) {
        receiptData = await readFileAsBase64(photo.uri);
      }
      const res = await api.submitGiftCard({
        brand: card.brand,
        faceValueUsd: faceValueNum,
        code: codeMode === 'type' ? code : undefined,
        receiptData,
        receiptMime: photo?.type ?? undefined,
        receiptFilename: photo?.name ?? undefined,
      });
      setStatus(res.message);
      setStatusOk(true);
      setSaleReceipt({
        heading: `Sell ${card.brand} Gift Card`,
        status: 'Pending verification',
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: 'Card value', value: `$${faceValue}` },
          { label: 'Rate', value: `${tier.percentage}%` },
          { label: 'You receive', value: formatNgn(payoutNgn) },
          { label: 'Code', value: codeMode === 'type' ? code : 'Attached as photo' },
          { label: 'Payout account', value: `${user.payoutBankName} · ${user.payoutAccountNumber}` },
          { label: 'Payout name', value: user.payoutAccountName || '' },
        ],
        footerNote: 'Payment is sent once our team verifies the code — usually within 15 minutes.',
      });
      setFaceValue('');
      setCode('');
      setPhoto(null);
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!user || !card || !tier || !canSubmit) return;
    Alert.alert(
      'Confirm sale',
      `You're selling ${card.brand} worth $${faceValue} at ${tier.percentage}% — you'll receive ${formatNgn(payoutNgn)}.\n\nOnce verified, this will be paid to:\n${user.payoutBankName} · ${user.payoutAccountNumber}\n${user.payoutAccountName}`,
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
              <Text style={styles.tileRate}>up to {Math.max(...r.tiers.map(t => t.percentage))}%</Text>
            </TouchableOpacity>
          ))}
        </View>

        {card && (
          <View style={styles.tierLadder}>
            <Text style={styles.flabel}>THE MORE YOU SELL, THE BETTER THE RATE</Text>
            <View style={styles.tierRow}>
              {card.tiers.map(t => (
                <View key={t.id} style={[styles.tierChip, tier?.id === t.id && styles.tierChipOn]}>
                  <Text style={[styles.tierChipText, tier?.id === t.id && styles.tierChipTextOn]}>{tierLabel(t)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.flabel}>CARD VALUE (USD)</Text>
          <TextInput style={styles.input} value={faceValue} onChangeText={setFaceValue} placeholder="100" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>YOU RECEIVE{tier ? ` · ${tier.percentage}% RATE` : ''}</Text>
          <Text style={styles.fval}>{formatNgn(payoutNgn)}</Text>
          {!tier && faceValueNum > 0 && <Text style={styles.noTierNote}>No rate configured for this amount yet.</Text>}
        </View>

        <View style={styles.field}>
          <View style={styles.fieldHead}>
            <Text style={styles.flabel}>CARD CODE</Text>
            <View style={styles.modeSeg}>
              <TouchableOpacity style={[styles.modeChip, codeMode === 'type' && styles.modeChipOn]} onPress={() => setCodeMode('type')}>
                <Text style={[styles.modeChipText, codeMode === 'type' && styles.modeChipTextOn]}>Type</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modeChip, codeMode === 'photo' && styles.modeChipOn]} onPress={() => setCodeMode('photo')}>
                <Text style={[styles.modeChipText, codeMode === 'photo' && styles.modeChipTextOn]}>Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
          {codeMode === 'type' ? (
            <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="XXXX-XXXX-XXXX" placeholderTextColor={colors.muted} />
          ) : photo ? (
            <View style={styles.photoRow}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              <Text style={styles.photoName} numberOfLines={1}>{photo.name}</Text>
              <TouchableOpacity onPress={() => setPhoto(null)}>
                <Text style={styles.photoRemove}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.attachBtn} onPress={pickPhoto}>
              <Text style={styles.attachBtnText}>📷 Take or choose a photo of the card</Text>
            </TouchableOpacity>
          )}
          {codeMode === 'photo' && (
            <Text style={styles.fsub}>An admin will view the photo and read the code themselves — no typing needed.</Text>
          )}
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

        <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || submitting}>
          <Text style={styles.ctaText}>{submitting ? 'Submitting…' : 'Submit for Verification'}</Text>
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
    tierLadder: { marginBottom: spacing.lg },
    tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
    tierChip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    tierChipOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    tierChipText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    tierChipTextOn: { color: colors.signalInk },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    fval: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs },
    noTierNote: { color: colors.ember, fontSize: 11, marginTop: spacing.xs },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    modeSeg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 2, gap: 2 },
    modeChip: { paddingVertical: 3, paddingHorizontal: spacing.sm, borderRadius: radius.pill },
    modeChipOn: { backgroundColor: colors.signal },
    modeChipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    modeChipTextOn: { color: colors.signalInk },
    fsub: { color: colors.muted, fontSize: 10.5, marginTop: spacing.sm, lineHeight: 15 },
    attachBtn: { backgroundColor: colors.surface2, borderRadius: radius.sm, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs },
    attachBtnText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    photoThumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surface2 },
    photoName: { flex: 1, color: colors.ink, fontSize: 13, fontWeight: '600' },
    photoRemove: { color: colors.ember, fontSize: 12, fontWeight: '700' },
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
