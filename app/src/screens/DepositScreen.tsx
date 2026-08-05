import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000];

export default function DepositScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { refreshUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const styles = getStyles(colors);

  async function submit() {
    if (!amount) return;
    setLoading(true);
    setStatus(null);
    try {
      await api.deposit(Number(amount));
      await refreshUser();
      setStatus(`₦${Number(amount).toLocaleString()} added to your wallet.`);
      setAmount('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Add Money" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
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

        <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} onPress={submit} disabled={!amount || loading}>
          <Text style={styles.ctaText}>{loading ? 'Processing…' : 'Add Money'}</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>
          Funds via card or bank transfer settle instantly to your wallet float.
        </Text>
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
    status: { color: colors.jade, fontSize: 12, marginBottom: spacing.sm },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
