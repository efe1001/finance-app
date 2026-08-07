import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useRefresh } from '../data/RefreshContext';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';

const BILLERS = [
  { label: 'Airtime', icon: 'airtime' },
  { label: 'Data', icon: 'data' },
  { label: 'Electricity', icon: 'electricity' },
  { label: 'Cable TV', icon: 'cableTv' },
  { label: 'Betting', icon: 'betting' },
  { label: 'Internet', icon: 'internet' },
  { label: 'Education', icon: 'education' },
  { label: 'Insurance', icon: 'insurance' },
];

export default function BillsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { refreshUser } = useAuth();
  const { refresh } = useRefresh();
  const styles = getStyles(colors);
  const [selected, setSelected] = useState('Airtime');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  async function doSubmit() {
    if (!recipient || !amount) return;
    setStatus(null);
    try {
      await api.addTransaction({ type: 'bill', title: selected, subtitle: recipient, amountNgn: -Number(amount) });
      await refreshUser();
      refresh();
      setStatus(`${selected} payment of ₦${amount} submitted — awaiting admin approval.`);
      setStatusOk(true);
      setRecipient('');
      setAmount('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    }
  }

  function submit() {
    if (!recipient || !amount) return;
    Alert.alert(
      `Confirm ${selected} payment`,
      `Pay ₦${Number(amount).toLocaleString()} for ${recipient}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: doSubmit },
      ],
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Bills & Recharge" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.grid}>
          {BILLERS.map(b => (
            <TouchableOpacity key={b.label} style={styles.tile} onPress={() => setSelected(b.label)}>
              <View style={[styles.tileBadgeWrap, selected === b.label && { borderColor: colors.signal }]}>
                <IconBadge name={b.icon} size={44} />
              </View>
              <Text style={[styles.tileLabel, selected === b.label && { color: colors.ink }]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.field}>
          <Text style={styles.flabel}>{selected === 'Electricity' ? 'METER NUMBER' : selected === 'Cable TV' ? 'SMARTCARD NUMBER' : 'PHONE NUMBER'}</Text>
          <TextInput style={styles.input} value={recipient} onChangeText={setRecipient} placeholder="Enter details" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>AMOUNT (₦)</Text>
          <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="0.00" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        <TouchableOpacity style={styles.cta} onPress={submit} disabled={!recipient || !amount}>
          <Text style={styles.ctaText}>Pay {selected}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
    tile: { width: '22%', alignItems: 'center', gap: spacing.xs },
    tileBadgeWrap: { borderRadius: 26, borderWidth: 2, borderColor: 'transparent', padding: 2 },
    tileLabel: { color: colors.muted, fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
  });
}
