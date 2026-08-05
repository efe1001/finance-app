import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Linking } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export default function DepositScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { refreshUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);
  const [loadingManual, setLoadingManual] = useState(false);
  const styles = getStyles(colors);

  async function payWithCard() {
    if (!amount) return;
    setLoadingCard(true);
    setStatus(null);
    try {
      const res = await api.flutterwave.initiateDeposit(Number(amount));
      await Linking.openURL(res.paymentLink);
      setStatus('Complete your payment in the browser, then come back and pull to refresh — your balance updates automatically once confirmed.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoadingCard(false);
    }
  }

  async function submitManual() {
    if (!amount) return;
    setLoadingManual(true);
    setStatus(null);
    try {
      const res = await api.deposit(Number(amount));
      await refreshUser();
      setStatus(res.message);
      setAmount('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoadingManual(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Add Money" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.label}>AMOUNT (₦)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.muted}
          keyboardType="decimal-pad"
        />

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map(v => (
            <TouchableOpacity key={v} style={styles.quickChip} onPress={() => setAmount(String(v))}>
              <Text style={styles.quickChipText}>₦{v.toLocaleString()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {status && <Text style={styles.status}>{status}</Text>}

        <TouchableOpacity style={[styles.cta, (!amount || loadingCard) && { opacity: 0.6 }]} onPress={payWithCard} disabled={!amount || loadingCard}>
          <Text style={styles.ctaText}>{loadingCard ? 'Opening…' : 'Pay with Card / Bank (Instant)'}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Powered by Flutterwave. Your wallet updates the moment payment is confirmed.</Text>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={[styles.ctaGhost, (!amount || loadingManual) && { opacity: 0.6 }]} onPress={submitManual} disabled={!amount || loadingManual}>
          <Text style={styles.ctaGhostText}>{loadingManual ? 'Submitting…' : 'I already sent a manual bank transfer'}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Reviewed and credited by an admin, usually within a few minutes.</Text>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    label: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: spacing.lg,
      color: colors.ink,
      fontSize: 24,
      fontWeight: '700',
      marginBottom: spacing.lg,
    },
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
    quickChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    quickChipText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
    status: { color: colors.jade, fontSize: 12, marginBottom: spacing.sm, lineHeight: 17 },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    ctaGhost: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    ctaGhostText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dividerText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  });
}
