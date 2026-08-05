import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

type Tab = 'approvals' | 'users' | 'stats' | 'wallets' | 'rates' | 'settings';

type PendingTxn = {
  id: number;
  type: string;
  title: string;
  subtitle: string | null;
  amount_ngn: number;
  address: string | null;
  user_name: string;
  user_email: string;
};

type AdminUser = {
  id: number;
  name: string;
  email: string;
  wallet_balance_ngn: number;
  is_admin: boolean;
};

export default function AdminDashboardScreen() {
  const { colors, mode, toggleMode } = useTheme();
  const { logout } = useAuth();
  const styles = getStyles(colors);
  const [tab, setTab] = useState<Tab>('approvals');

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text style={styles.title}>Control Center</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleMode}>
            <Text style={styles.iconBtnGlyph}>{mode === 'dark' ? '☀' : '☾'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={logout}>
            <Text style={styles.iconBtnGlyph}>⎋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ gap: spacing.sm }}>
        {(['approvals', 'users', 'stats', 'wallets', 'rates', 'settings'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && styles.tabBtnOn]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === 'approvals' ? 'Approvals' : t === 'users' ? 'Users' : t === 'stats' ? 'Analytics' : t === 'wallets' ? 'Wallets' : t === 'rates' ? 'Gift Cards' : 'Limits'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'approvals' && <ApprovalsTab colors={colors} />}
      {tab === 'users' && <UsersTab colors={colors} />}
      {tab === 'stats' && <StatsTab colors={colors} />}
      {tab === 'wallets' && <WalletsTab colors={colors} />}
      {tab === 'rates' && <RatesTab colors={colors} />}
      {tab === 'settings' && <LimitsTab colors={colors} />}
    </View>
  );
}

function ApprovalsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [items, setItems] = useState<PendingTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.admin.pendingTransactions());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(id: number) {
    setBusyId(id);
    try {
      await api.admin.approveTransaction(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    setBusyId(id);
    try {
      await api.admin.rejectTransaction(id);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
      {items.length === 0 && !loading && <Text style={styles.empty}>No pending approvals — all caught up.</Text>}
      {items.map(item => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSub}>{item.user_name} · {item.user_email}</Text>
              {item.subtitle ? <Text style={styles.cardSub}>{item.subtitle}</Text> : null}
              {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
            </View>
            <Text style={[styles.cardAmt, item.amount_ngn < 0 ? { color: colors.ember } : { color: colors.jade }]}>
              {item.amount_ngn < 0 ? '-' : '+'}₦{Math.abs(item.amount_ngn).toLocaleString()}
            </Text>
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.rejectBtn} disabled={busyId === item.id} onPress={() => reject(item.id)}>
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} disabled={busyId === item.id} onPress={() => approve(item.id)}>
              <Text style={styles.approveText}>{busyId === item.id ? '…' : 'Approve'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function UsersTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<AdminUser | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.admin.users());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitAdjust() {
    if (!target || !adjustAmount) return;
    try {
      await api.admin.adjustBalance(target.id, Number(adjustAmount));
      setTarget(null);
      setAdjustAmount('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        {users.map(u => (
          <View key={u.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View>
                <Text style={styles.cardTitle}>{u.name} {u.is_admin && '(Admin)'}</Text>
                <Text style={styles.cardSub}>{u.email}</Text>
              </View>
              <Text style={styles.cardAmt}>₦{Number(u.wallet_balance_ngn).toLocaleString()}</Text>
            </View>
            <TouchableOpacity style={styles.adjustBtn} onPress={() => setTarget(u)}>
              <Text style={styles.adjustBtnText}>Add / Reduce Balance</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adjust {target?.name}'s Balance</Text>
            <Text style={styles.modalHint}>Positive to add, negative to reduce (e.g. -5000)</Text>
            <TextInput style={styles.input} value={adjustAmount} onChangeText={setAdjustAmount} placeholder="Amount (₦)" placeholderTextColor={colors.muted} keyboardType="numbers-and-punctuation" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTarget(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSubmit} onPress={submitAdjust}>
                <Text style={styles.modalSubmitText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function StatsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.admin.stats().then(setStats);
  }, []);

  if (!stats) return <View style={styles.content} />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>TOTAL USERS</Text>
          <Text style={styles.statValue}>{stats.totalUsers}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>PENDING</Text>
          <Text style={styles.statValue}>{stats.pendingApprovals}</Text>
        </View>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statLabel}>TOTAL WALLET BALANCE (ALL USERS)</Text>
        <Text style={styles.statValue}>₦{stats.totalBalanceNgn.toLocaleString()}</Text>
      </View>

      <Text style={styles.sectionHead}>BY TYPE & STATUS</Text>
      {stats.breakdown.map((row: any, idx: number) => (
        <View key={idx} style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>{row.type} · {row.status}</Text>
          <Text style={styles.breakdownValue}>{row.count}× · ₦{Math.abs(row.total_ngn).toLocaleString()}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function WalletsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [wallets, setWallets] = useState<{ asset: string; address: string }[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [savingAsset, setSavingAsset] = useState<string | null>(null);

  const load = useCallback(() => {
    api.admin.wallets().then(w => {
      setWallets(w);
      const e: Record<string, string> = {};
      w.forEach(x => (e[x.asset] = x.address));
      setEdited(e);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(asset: string) {
    setSavingAsset(asset);
    try {
      await api.admin.updateWallet(asset, edited[asset] ?? '');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingAsset(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.modalHint}>
        Users sending crypto to sell see this address. Keep these accurate — funds sent to the wrong address can't be recovered.
      </Text>
      {wallets.map(w => (
        <View key={w.asset} style={styles.field}>
          <Text style={styles.flabel}>{w.asset} DEPOSIT ADDRESS</Text>
          <TextInput
            style={styles.input}
            value={edited[w.asset] ?? ''}
            onChangeText={v => setEdited(s => ({ ...s, [w.asset]: v }))}
            placeholder={`Enter ${w.asset} address`}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.adjustBtn} onPress={() => save(w.asset)} disabled={savingAsset === w.asset}>
            <Text style={styles.adjustBtnText}>{savingAsset === w.asset ? 'Saving…' : 'Save Address'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

function RatesTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [rates, setRates] = useState<{ brand: string; ratePerDollar: number }[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [savingBrand, setSavingBrand] = useState<string | null>(null);
  const [newBrand, setNewBrand] = useState('');
  const [newRate, setNewRate] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    api.admin.giftCardRates().then(r => {
      setRates(r);
      const e: Record<string, string> = {};
      r.forEach(x => (e[x.brand] = String(x.ratePerDollar)));
      setEdited(e);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(brand: string) {
    setSavingBrand(brand);
    try {
      await api.admin.updateGiftCardRate(brand, Number(edited[brand]));
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingBrand(null);
    }
  }

  async function remove(brand: string) {
    setSavingBrand(brand);
    try {
      await api.admin.deleteGiftCardRate(brand);
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingBrand(null);
    }
  }

  async function addNew() {
    if (!newBrand || !newRate) return;
    setAdding(true);
    try {
      await api.admin.updateGiftCardRate(newBrand, Number(newRate));
      setNewBrand('');
      setNewRate('');
      load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.modalHint}>
        Rate is what a user is paid per $1 face value. Edit and save, or add a new card brand below.
      </Text>
      {rates.map(r => (
        <View key={r.brand} style={styles.field}>
          <Text style={styles.flabel}>{r.brand.toUpperCase()} — ₦ PER $1</Text>
          <TextInput
            style={styles.input}
            value={edited[r.brand] ?? ''}
            onChangeText={v => setEdited(s => ({ ...s, [r.brand]: v }))}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.muted}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
            <TouchableOpacity style={[styles.adjustBtn, { flex: 1 }]} onPress={() => save(r.brand)} disabled={savingBrand === r.brand}>
              <Text style={styles.adjustBtnText}>{savingBrand === r.brand ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.rejectBtn, { flex: 1 }]} onPress={() => remove(r.brand)} disabled={savingBrand === r.brand}>
              <Text style={styles.rejectText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionHead}>ADD NEW CARD BRAND</Text>
      <View style={styles.field}>
        <Text style={styles.flabel}>BRAND NAME</Text>
        <TextInput style={styles.input} value={newBrand} onChangeText={setNewBrand} placeholder="e.g. Vanilla" placeholderTextColor={colors.muted} />
      </View>
      <View style={styles.field}>
        <Text style={styles.flabel}>₦ PER $1</Text>
        <TextInput style={styles.input} value={newRate} onChangeText={setNewRate} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
      </View>
      <TouchableOpacity style={styles.cta} onPress={addNew} disabled={adding || !newBrand || !newRate}>
        <Text style={styles.ctaText}>{adding ? 'Adding…' : 'Add Card Brand'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function LimitsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.admin.getSettings().then(setSettings);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      Alert.alert('Saved', 'Limits updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: string; label: string }[] = [
    { key: 'min_deposit_ngn', label: 'Minimum deposit (₦)' },
    { key: 'max_deposit_ngn', label: 'Maximum deposit (₦)' },
    { key: 'min_withdrawal_ngn', label: 'Minimum withdrawal (₦)' },
    { key: 'max_withdrawal_ngn', label: 'Maximum withdrawal (₦)' },
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {fields.map(f => (
        <View key={f.key} style={styles.field}>
          <Text style={styles.flabel}>{f.label}</Text>
          <TextInput
            style={styles.input}
            value={settings[f.key] ?? ''}
            onChangeText={v => setSettings(s => ({ ...s, [f.key]: v }))}
            keyboardType="number-pad"
            placeholderTextColor={colors.muted}
          />
        </View>
      ))}
      <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
        <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save Limits'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xl },
    eyebrow: { color: colors.signal, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    title: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 2 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    iconBtnGlyph: { color: colors.ink, fontSize: 16 },
    tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    tabBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    tabBtnOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    tabText: { color: colors.muted, fontSize: 11.5, fontWeight: '700' },
    tabTextOn: { color: colors.signalInk },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    empty: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: spacing.xxl },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardSub: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
    cardAddress: { color: colors.signal, fontSize: 11, marginTop: 4, fontFamily: 'monospace' },
    cardAmt: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    rejectBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.ember },
    rejectText: { color: colors.ember, fontWeight: '700', fontSize: 12.5 },
    approveBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.jade },
    approveText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
    adjustBtn: { marginTop: spacing.sm, alignItems: 'center', padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface2 },
    adjustBtnText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
    modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
    modalHint: { color: colors.muted, fontSize: 11, marginBottom: spacing.md },
    input: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, marginBottom: spacing.sm },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    modalCancel: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
    modalCancelText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    modalSubmit: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.signal },
    modalSubmitText: { color: colors.signalInk, fontWeight: '700', fontSize: 13 },
    statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    statLabel: { color: colors.muted, fontSize: 10.5, letterSpacing: 0.5 },
    statValue: { color: colors.ink, fontSize: 22, fontWeight: '700', marginTop: spacing.xs },
    sectionHead: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },
    breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    breakdownLabel: { color: colors.ink, fontSize: 12.5, textTransform: 'capitalize' },
    breakdownValue: { color: colors.muted, fontSize: 12 },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5, marginBottom: spacing.xs },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
  });
}
