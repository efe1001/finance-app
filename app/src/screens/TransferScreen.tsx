import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useCurrency } from '../currency/CurrencyContext';
import { useRefresh } from '../data/RefreshContext';
import ScreenHeader from '../components/ScreenHeader';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';

export default function TransferScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const { refresh } = useRefresh();
  const { formatNgn } = useCurrency();
  const styles = getStyles(colors);

  const [handle, setHandle] = useState('');
  const [amount, setAmount] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const resolve = useCallback(async (h: string) => {
    setResolving(true);
    setResolveError(null);
    setResolvedName(null);
    try {
      const res = await api.resolveTransferRecipient(h);
      setResolvedName(res.name);
    } catch (e: any) {
      setResolveError(e.message || 'Could not find that user');
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = handle.trim();
    if (trimmed.length < 3) {
      setResolvedName(null);
      setResolveError(null);
      return;
    }
    const t = setTimeout(() => resolve(trimmed), 400);
    return () => clearTimeout(t);
  }, [handle, resolve]);

  const amountNgn = parseFloat(amount || '0');
  const canSubmit = amountNgn > 0 && !!resolvedName && !resolving;

  async function doSubmit() {
    setStatus(null);
    setSubmitting(true);
    try {
      const res = await api.transfer({ recipient: handle.trim(), amountNgn });
      setStatus(res.message);
      setStatusOk(true);
      await refreshUser();
      refresh();
      setReceipt({
        heading: `Sent to ${res.recipientName}`,
        status: 'Successful',
        rows: [
          { label: 'Date', value: new Date().toLocaleString() },
          { label: 'Amount', value: formatNgn(amountNgn) },
          { label: 'To', value: res.recipientName },
        ],
        footerNote: 'Money out of your wallet.',
      });
      setHandle('');
      setAmount('');
      setResolvedName(null);
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!canSubmit) return;
    Alert.alert('Confirm transfer', `Send ${formatNgn(amountNgn)} to ${resolvedName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: doSubmit },
    ]);
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Send Money" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>WALLET BALANCE</Text>
          <Text style={styles.balanceAmount}>{formatNgn(user?.walletBalanceNgn ?? 0)}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>SEND TO</Text>
          <TextInput
            style={styles.input}
            value={handle}
            onChangeText={setHandle}
            placeholder="Username, email, or phone number"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>

        {resolving && (
          <View style={styles.resolveRow}>
            <ActivityIndicator size="small" color={colors.signal} />
            <Text style={styles.resolveText}>Looking up user…</Text>
          </View>
        )}
        {resolvedName && (
          <View style={styles.resolveRow}>
            <Text style={styles.resolvedName}>✓ {resolvedName}</Text>
          </View>
        )}
        {resolveError && !resolving && (
          <View style={styles.resolveRow}>
            <Text style={styles.resolveErrorText}>{resolveError}</Text>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.flabel}>AMOUNT</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(user?.walletBalanceNgn ?? 0))}>
              <Text style={styles.maxBtnText}>Max</Text>
            </TouchableOpacity>
          </View>
        </View>

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || submitting}>
          <Text style={styles.ctaText}>{submitting ? 'Sending…' : 'Send Money'}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Instant — arrives in the recipient's wallet immediately and can be withdrawn to their bank like any other funds.</Text>
      </ScrollView>
      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} colors={colors} />
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
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    amountInput: { flex: 1, color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: spacing.xs, padding: 0 },
    maxBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    maxBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
    resolveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
    resolveText: { color: colors.muted, fontSize: 12 },
    resolvedName: { color: colors.jade, fontSize: 13, fontWeight: '700' },
    resolveErrorText: { color: colors.ember, fontSize: 12 },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
