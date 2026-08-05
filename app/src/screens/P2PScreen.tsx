import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import ScreenHeader from '../components/ScreenHeader';

type Listing = {
  id: number;
  side: string;
  asset: string;
  amount: number;
  rate_ngn: number;
  payment_method: string;
  seller_name: string;
};

export default function P2PScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [side, setSide] = useState('sell');
  const [asset, setAsset] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setListings(await api.p2pListings());
    } catch (e) {
      // keep last known list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createListing() {
    if (!amount || !rate) return;
    setError(null);
    try {
      await api.createP2pListing({ side, asset, amount: parseFloat(amount), rateNgn: parseFloat(rate) });
      setFormOpen(false);
      setAmount('');
      setRate('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader
        title="P2P · Direct"
        onBack={onBack}
        colors={colors}
        right={
          <TouchableOpacity style={styles.sellBtn} onPress={() => setFormOpen(true)}>
            <Text style={styles.sellBtnText}>+ Sell</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {listings.length === 0 && !loading && <Text style={styles.empty}>No open offers yet. Be the first to list one.</Text>}

        {listings.map(item => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.seller_name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.sellerName}>@{item.seller_name.split(' ')[0].toLowerCase()}</Text>
            </View>
            <Text style={styles.amt}>{item.side === 'sell' ? 'Selling' : 'Buying'} {item.amount} {item.asset}</Text>
            <Text style={styles.rate}>Rate ₦{item.rate_ngn.toLocaleString()}/{item.asset} · direct to {item.side === 'sell' ? 'seller' : 'buyer'}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.methodChip}>{item.payment_method}</Text>
              <Text style={styles.viewBtn}>View offer →</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="fade" onRequestClose={() => setFormOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Listing</Text>
            <View style={styles.seg}>
              <TouchableOpacity style={[styles.segItem, side === 'sell' && styles.segItemOn]} onPress={() => setSide('sell')}>
                <Text style={[styles.segText, side === 'sell' && styles.segTextOn]}>Sell</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segItem, side === 'buy' && styles.segItemOn]} onPress={() => setSide('buy')}>
                <Text style={[styles.segText, side === 'buy' && styles.segTextOn]}>Buy</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} value={asset} onChangeText={setAsset} placeholder="Asset (e.g. BTC)" placeholderTextColor={colors.muted} />
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
            <TextInput style={styles.input} value={rate} onChangeText={setRate} placeholder="Rate per unit (₦)" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
            {error && <Text style={styles.error}>{error}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setFormOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={createListing}>
                <Text style={styles.modalSubmitText}>Post Listing</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    sellBtn: { backgroundColor: colors.signal, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    sellBtnText: { color: colors.signalInk, fontWeight: '700', fontSize: 12 },
    empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: spacing.xxl },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.signalInk, fontWeight: '700', fontSize: 12 },
    sellerName: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    amt: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: spacing.sm },
    rate: { color: colors.muted, fontSize: 11, marginTop: 2 },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
    methodChip: { fontSize: 10, backgroundColor: colors.surface2, color: colors.muted, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
    viewBtn: { color: colors.signal, fontWeight: '700', fontSize: 11 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
    modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginBottom: spacing.lg },
    seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 4, marginBottom: spacing.md },
    segItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
    segItemOn: { backgroundColor: colors.signal },
    segText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    segTextOn: { color: colors.signalInk },
    input: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, marginBottom: spacing.sm },
    error: { color: colors.ember, fontSize: 12, marginBottom: spacing.sm },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    modalCancel: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
    modalCancelText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    modalSubmit: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.signal },
    modalSubmitText: { color: colors.signalInk, fontWeight: '700', fontSize: 13 },
  });
}
