import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

export default function WithdrawScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const [limits, setLimits] = useState<{ min_withdrawal_ngn: number; max_withdrawal_ngn: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [narration, setNarration] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.limits().then(setLimits as any).catch(() => {});
  }, []);

  async function submit() {
    if (!amount || !accountNumber || !bankName) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.withdraw({
        amountNgn: Number(amount),
        accountNumber,
        bankName,
        narration: narration || undefined,
      });
      setStatus(res.message);
      setAmount('');
      setAccountNumber('');
      setBankName('');
      setNarration('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Withdraw Naira" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceIcon}>
            <Text style={styles.balanceIconText}>₦</Text>
          </View>
          <View>
            <Text style={styles.balanceAmount}>
              ₦{(user?.walletBalanceNgn ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.balanceLabel}>NGN Balance</Text>
          </View>
        </View>

        {limits && (
          <Text style={styles.limitsNote}>
            Withdrawal limits: ₦{limits.min_withdrawal_ngn.toLocaleString()} – ₦{limits.max_withdrawal_ngn.toLocaleString()}
          </Text>
        )}

        <View style={styles.field}>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter Amount"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(user?.walletBalanceNgn ?? 0))}>
            <Text style={styles.maxBtnText}>Max</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.fieldSimple}>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="Account Number"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.fieldSimple}>
          <TextInput
            style={styles.input}
            value={bankName}
            onChangeText={setBankName}
            placeholder="Bank Name"
            placeholderTextColor={colors.muted}
          />
        </View>
        <View style={styles.fieldSimple}>
          <TextInput
            style={styles.input}
            value={narration}
            onChangeText={setNarration}
            placeholder="Add Narration (optional)"
            placeholderTextColor={colors.muted}
          />
        </View>

        {status && <Text style={styles.status}>{status}</Text>}

        <Text style={styles.savedHead}>SAVED BENEFICIARIES</Text>
        <Text style={styles.empty}>No saved beneficiaries</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, (!amount || !accountNumber || !bankName || loading) && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!amount || !accountNumber || !bankName || loading}>
          <Text style={styles.ctaText}>{loading ? 'Submitting…' : 'Withdraw'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    balanceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.jade, alignItems: 'center', justifyContent: 'center' },
    balanceIconText: { color: colors.jade, fontWeight: '700', fontSize: 16 },
    balanceAmount: { color: colors.ink, fontSize: 22, fontWeight: '700' },
    balanceLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
    limitsNote: { color: colors.muted, fontSize: 11, marginBottom: spacing.lg },
    field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    amountInput: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: spacing.lg },
    maxBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    maxBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
    fieldSimple: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    input: { color: colors.ink, fontSize: 15, paddingVertical: spacing.lg },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    savedHead: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm },
    empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
  });
}
