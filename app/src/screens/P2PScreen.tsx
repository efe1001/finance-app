import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';
import ReceiptModal, { Receipt } from '../components/ReceiptModal';

type Listing = {
  id: number;
  side: string;
  asset: string;
  amount: number;
  rate_ngn: number;
  payment_method: string;
  seller_name: string;
};

type MyListing = Listing & {
  status: string;
  user_id: number;
  buyer_id: number | null;
  buyer_name: string | null;
};

const ASSETS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE'];

const STATUS_LABEL: Record<string, string> = {
  Open: 'Waiting for a taker',
  Claimed: 'Claimed — awaiting payment',
  PaymentSent: 'Payment sent — awaiting confirmation',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
};

export default function P2PScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  const { user } = useAuth();
  const [view, setView] = useState<'browse' | 'mine'>('browse');
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [side, setSide] = useState('sell');
  const [asset, setAsset] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tradeReceipt, setTradeReceipt] = useState<Receipt | null>(null);

  function openReceipt(item: MyListing) {
    const isLister = item.user_id === user?.id;
    const otherName = isLister ? item.buyer_name : item.seller_name;
    setTradeReceipt({
      heading: `${item.side === 'sell' ? 'Sell' : 'Buy'} ${item.amount} ${item.asset}`,
      status: STATUS_LABEL[item.status] || item.status,
      rows: [
        { label: 'Role', value: isLister ? 'You listed this' : 'You claimed this' },
        { label: 'Counterparty', value: otherName || 'Not yet matched' },
        { label: 'Rate', value: `₦${item.rate_ngn.toLocaleString()} / ${item.asset}` },
        { label: 'Total', value: `₦${(item.amount * item.rate_ngn).toLocaleString()}` },
        { label: 'Payment method', value: item.payment_method },
        { label: 'Reference ID', value: `#${item.id}` },
      ],
      footerNote: 'P2P trades settle directly between the two parties — Finance App does not hold or move these funds.',
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [open, own] = await Promise.all([api.p2pListings().catch(() => []), api.myP2pListings().catch(() => [])]);
      setListings(open);
      setMine(own);
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

  async function claim(id: number) {
    setBusyId(id);
    try {
      await api.claimP2pListing(id);
      await load();
      setView('mine');
      Alert.alert('Claimed', "Coordinate payment directly with the other party, then mark it paid once you've sent it.");
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function doMarkPaid(id: number) {
    setBusyId(id);
    try {
      await api.markP2pPaid(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  function markPaid(id: number) {
    Alert.alert('Confirm payment sent', "Only confirm this once you've actually sent the money — the other party will be notified to release funds.", [
      { text: 'Cancel', style: 'cancel' },
      { text: "Yes, I've Paid", onPress: () => doMarkPaid(id) },
    ]);
  }

  async function doConfirm(id: number) {
    setBusyId(id);
    try {
      await api.confirmP2pTrade(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  function confirm(id: number) {
    Alert.alert('Confirm funds received', "Only confirm once you've actually received payment — this completes the trade and can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Confirm', onPress: () => doConfirm(id) },
    ]);
  }

  async function cancel(id: number) {
    setBusyId(id);
    try {
      await api.cancelP2pListing(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
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
            <Text style={styles.sellBtnText}>+ List</Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.seg}>
        <TouchableOpacity style={[styles.segItem, view === 'browse' && styles.segItemOn]} onPress={() => setView('browse')}>
          <Text style={[styles.segText, view === 'browse' && styles.segTextOn]}>Browse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.segItem, view === 'mine' && styles.segItemOn]} onPress={() => setView('mine')}>
          <Text style={[styles.segText, view === 'mine' && styles.segTextOn]}>My Trades</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {view === 'browse' ? (
          <>
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
                  <TouchableOpacity disabled={busyId === item.id} onPress={() => claim(item.id)}>
                    <Text style={styles.viewBtn}>{busyId === item.id ? 'Claiming…' : 'Claim offer →'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            {mine.length === 0 && !loading && <Text style={styles.empty}>No trades yet — browse offers or post your own listing.</Text>}
            {mine.map(item => {
              const isLister = item.user_id === user?.id;
              const otherName = isLister ? item.buyer_name : item.seller_name;
              const canMarkPaid = item.status === 'Claimed';
              const canConfirm = item.status === 'PaymentSent';
              const canCancel = ['Open', 'Claimed'].includes(item.status);
              return (
                <View key={item.id} style={styles.card}>
                  <Text style={styles.amt}>{item.side === 'sell' ? 'Selling' : 'Buying'} {item.amount} {item.asset}</Text>
                  <Text style={styles.rate}>
                    Rate ₦{item.rate_ngn.toLocaleString()}/{item.asset} · {isLister ? 'you listed' : 'you claimed'}
                    {otherName ? ` · with ${otherName}` : ''}
                  </Text>
                  <View style={styles.cardBottom}>
                    <View style={[styles.statusPill, statusPillStyle(item.status, colors)]}>
                      <Text style={[styles.statusPillText, { color: statusColor(item.status, colors) }]}>{STATUS_LABEL[item.status]}</Text>
                    </View>
                    <TouchableOpacity onPress={() => openReceipt(item)}>
                      <Text style={styles.viewBtn}>Receipt →</Text>
                    </TouchableOpacity>
                  </View>
                  {(canMarkPaid || canConfirm || canCancel) && (
                    <View style={styles.tradeActions}>
                      {canCancel && (
                        <TouchableOpacity style={styles.cancelBtn} disabled={busyId === item.id} onPress={() => cancel(item.id)}>
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                      {canMarkPaid && (
                        <TouchableOpacity style={styles.primaryBtn} disabled={busyId === item.id} onPress={() => markPaid(item.id)}>
                          <Text style={styles.primaryBtnText}>{busyId === item.id ? '…' : "I've Paid"}</Text>
                        </TouchableOpacity>
                      )}
                      {canConfirm && (
                        <TouchableOpacity style={styles.primaryBtn} disabled={busyId === item.id} onPress={() => confirm(item.id)}>
                          <Text style={styles.primaryBtnText}>{busyId === item.id ? '…' : 'Confirm Received'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
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
            <View style={styles.assetPicker}>
              {ASSETS.map(a => (
                <TouchableOpacity key={a} style={[styles.assetPickerChip, asset === a && styles.assetPickerChipOn]} onPress={() => setAsset(a)}>
                  <Text style={[styles.assetPickerChipText, asset === a && styles.assetPickerChipTextOn]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
      <ReceiptModal receipt={tradeReceipt} onClose={() => setTradeReceipt(null)} colors={colors} />
    </View>
  );
}

function statusColor(status: string, colors: ThemeColors) {
  if (status === 'Completed') return colors.jade;
  if (status === 'Cancelled') return colors.ember;
  return colors.signal;
}

function statusPillStyle(status: string, colors: ThemeColors) {
  const c = statusColor(status, colors);
  return { backgroundColor: c + '26' };
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
    statusPill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.sm },
    statusPillText: { fontSize: 11, fontWeight: '700' },
    tradeActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    cancelBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ember },
    cancelBtnText: { color: colors.ember, fontWeight: '700', fontSize: 12.5 },
    primaryBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.signal },
    primaryBtnText: { color: colors.signalInk, fontWeight: '700', fontSize: 12.5 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
    modalTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginBottom: spacing.lg },
    seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: 4, marginHorizontal: spacing.lg, marginBottom: spacing.md },
    segItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm - 2 },
    segItemOn: { backgroundColor: colors.signal },
    segText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    segTextOn: { color: colors.signalInk },
    input: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, marginBottom: spacing.sm },
    assetPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.md },
    assetPickerChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: 'transparent' },
    assetPickerChipOn: { backgroundColor: colors.signal },
    assetPickerChipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    assetPickerChipTextOn: { color: colors.signalInk },
    error: { color: colors.ember, fontSize: 12, marginBottom: spacing.sm },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    modalCancel: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
    modalCancelText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    modalSubmit: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.signal },
    modalSubmitText: { color: colors.signalInk, fontWeight: '700', fontSize: 13 },
  });
}
