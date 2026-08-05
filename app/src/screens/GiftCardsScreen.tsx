import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import IconBadge from '../components/IconBadge';

type Rate = { brand: string; ratePerDollar: number };

export default function GiftCardsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [faceValue, setFaceValue] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);

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

  async function submit() {
    if (!user || !card || !faceValue || !code) return;
    setStatus(null);
    try {
      const res = await api.submitGiftCard({ brand: card.brand, faceValueUsd: parseFloat(faceValue), code });
      setStatus(res.message);
      setFaceValue('');
      setCode('');
    } catch (e: any) {
      setStatus(e.message);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Gift Cards" onBack={onBack} colors={colors} right={<IconBadge name="giftcard" size={30} glyphSize={14} />} />
      <ScrollView
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
          <Text style={styles.fval}>₦{Number(payoutNgn).toLocaleString()}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>CARD CODE</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="XXXX-XXXX-XXXX" placeholderTextColor={colors.muted} />
        </View>

        {status && <Text style={styles.status}>{status}</Text>}

        <TouchableOpacity style={styles.cta} onPress={submit} disabled={!faceValue || !code}>
          <Text style={styles.ctaText}>Submit for Verification</Text>
        </TouchableOpacity>
        <Text style={styles.trustNote}>Payout releases once our team confirms the code — usually within 15 minutes.</Text>
      </ScrollView>
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
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    trustNote: { color: colors.muted, fontSize: 10.5, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
  });
}
