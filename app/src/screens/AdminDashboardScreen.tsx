import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import IconBadge from '../components/IconBadge';

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

type Overview = { totalUsers: number; totalBalanceNgn: number; pendingApprovals: number };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'approvals', label: 'Approvals', icon: 'approvals' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'stats', label: 'Analytics', icon: 'stats' },
  { key: 'wallets', label: 'Wallets', icon: 'vault' },
  { key: 'rates', label: 'Gift Cards', icon: 'giftcard' },
  { key: 'settings', label: 'Limits', icon: 'limits' },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export default function AdminDashboardScreen() {
  const { colors, mode, toggleMode } = useTheme();
  const { user, logout } = useAuth();
  const styles = getStyles(colors);
  const [tab, setTab] = useState<Tab>('approvals');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const bump = useCallback(() => setRefreshTick(t => t + 1), []);

  useEffect(() => {
    api.admin.stats().then(s =>
      setOverview({ totalUsers: s.totalUsers, totalBalanceNgn: s.totalBalanceNgn, pendingApprovals: s.pendingApprovals }),
    ).catch(() => {});
  }, [refreshTick]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.brandDot} />
          <View>
            <Text style={styles.eyebrow}>ADMIN CONTROL CENTER</Text>
            <Text style={styles.title}>{user?.name ?? 'Admin'}</Text>
          </View>
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

      <View style={styles.overviewRow}>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{overview ? overview.pendingApprovals : '—'}</Text>
          <Text style={styles.overviewLabel}>PENDING</Text>
        </View>
        <View style={styles.overviewCard}>
          <Text style={styles.overviewValue}>{overview ? overview.totalUsers : '—'}</Text>
          <Text style={styles.overviewLabel}>USERS</Text>
        </View>
        <View style={[styles.overviewCard, { flex: 1.4 }]}>
          <Text style={styles.overviewValue} numberOfLines={1}>
            {overview ? `₦${overview.totalBalanceNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          </Text>
          <Text style={styles.overviewLabel}>TOTAL BALANCE</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ gap: spacing.sm, paddingRight: spacing.lg }}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} style={[styles.tabBtn, tab === t.key && styles.tabBtnOn]} onPress={() => setTab(t.key)}>
            <IconBadge name={t.icon} size={20} glyphSize={11} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            {t.key === 'approvals' && !!overview?.pendingApprovals && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{overview.pendingApprovals}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {tab === 'approvals' && <ApprovalsTab colors={colors} onChanged={bump} />}
      {tab === 'users' && <UsersTab colors={colors} onChanged={bump} />}
      {tab === 'stats' && <StatsTab colors={colors} />}
      {tab === 'wallets' && <WalletsTab colors={colors} />}
      {tab === 'rates' && <RatesTab colors={colors} />}
      {tab === 'settings' && <LimitsTab colors={colors} />}
    </View>
  );
}

function typeIcon(type: string) {
  if (['crypto', 'deposit', 'withdrawal', 'admin_adjustment', 'giftcard', 'bills', 'p2p'].includes(type)) return type;
  return 'swap';
}

const ASSET_ICON: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  USDC: 'usd-coin',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  DOGE: 'dogecoin',
};

function ApprovalsTab({ colors, onChanged }: { colors: ThemeColors; onChanged: () => void }) {
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
      await load();
      onChanged();
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
      await load();
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
      {items.length === 0 && !loading && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>✓</Text>
          <Text style={styles.empty}>All caught up — no pending approvals.</Text>
        </View>
      )}
      {items.map(item => {
        const isAuto = (item.subtitle || '').toLowerCase().includes('quidax');
        return (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardTopLeft}>
                <IconBadge name={typeIcon(item.type)} size={40} />
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {isAuto && (
                      <View style={styles.autoChip}>
                        <Text style={styles.autoChipText}>⚡ Auto</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardSub}>{item.user_name} · {item.user_email}</Text>
                  {item.subtitle ? <Text style={styles.cardSub}>{item.subtitle}</Text> : null}
                  {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
                </View>
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
        );
      })}
    </ScrollView>
  );
}

function UsersTab({ colors, onChanged }: { colors: ThemeColors; onChanged: () => void }) {
  const styles = getStyles(colors);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
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
      await load();
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  }

  const filtered = users.filter(
    u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or email…"
            placeholderTextColor={colors.muted}
          />
        </View>
        {filtered.map(u => (
          <View key={u.id} style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials(u.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.cardTitle}>{u.name}</Text>
                  {u.is_admin && (
                    <View style={styles.adminChip}>
                      <Text style={styles.adminChipText}>ADMIN</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.cardSub}>{u.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardAmt}>₦{Number(u.wallet_balance_ngn).toLocaleString()}</Text>
                <TouchableOpacity style={styles.adjustLink} onPress={() => setTarget(u)}>
                  <Text style={styles.adjustLinkText}>Adjust ›</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
        {filtered.length === 0 && !loading && <Text style={styles.empty}>No users match "{search}".</Text>}
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

  const maxCount = Math.max(1, ...stats.breakdown.map((r: any) => r.count));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.sectionHead}>ACTIVITY BY TYPE & STATUS</Text>
      {stats.breakdown.map((row: any, idx: number) => (
        <View key={idx} style={styles.barRow}>
          <View style={styles.barRowTop}>
            <Text style={styles.breakdownLabel}>{row.type} · {row.status}</Text>
            <Text style={styles.breakdownValue}>{row.count}× · ₦{Math.abs(row.total_ngn).toLocaleString()}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${(row.count / maxCount) * 100}%` }]} />
          </View>
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
        <View key={w.asset} style={styles.card}>
          <View style={styles.fieldHeadRow}>
            <IconBadge name={ASSET_ICON[w.asset] ?? w.asset.toLowerCase()} size={32} />
            <Text style={styles.flabel}>{w.asset} DEPOSIT ADDRESS</Text>
          </View>
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
        <View key={r.brand} style={styles.card}>
          <View style={styles.fieldHeadRow}>
            <IconBadge name="giftcard" size={32} />
            <Text style={styles.flabel}>{r.brand.toUpperCase()} — ₦ PER $1</Text>
          </View>
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
      <View style={styles.card}>
        <Text style={styles.flabel}>BRAND NAME</Text>
        <TextInput style={styles.input} value={newBrand} onChangeText={setNewBrand} placeholder="e.g. Vanilla" placeholderTextColor={colors.muted} />
        <Text style={[styles.flabel, { marginTop: spacing.sm }]}>₦ PER $1</Text>
        <TextInput style={styles.input} value={newRate} onChangeText={setNewRate} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
        <TouchableOpacity style={styles.cta} onPress={addNew} disabled={adding || !newBrand || !newRate}>
          <Text style={styles.ctaText}>{adding ? 'Adding…' : 'Add Card Brand'}</Text>
        </TouchableOpacity>
      </View>
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

  const groups: { head: string; icon: string; fields: { key: string; label: string }[] }[] = [
    { head: 'DEPOSITS', icon: 'deposit', fields: [
      { key: 'min_deposit_ngn', label: 'Minimum deposit (₦)' },
      { key: 'max_deposit_ngn', label: 'Maximum deposit (₦)' },
    ] },
    { head: 'WITHDRAWALS', icon: 'withdrawal', fields: [
      { key: 'min_withdrawal_ngn', label: 'Minimum withdrawal (₦)' },
      { key: 'max_withdrawal_ngn', label: 'Maximum withdrawal (₦)' },
    ] },
  ];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      {groups.map(g => (
        <View key={g.head} style={styles.card}>
          <View style={styles.fieldHeadRow}>
            <IconBadge name={g.icon} size={32} />
            <Text style={styles.sectionHead}>{g.head}</Text>
          </View>
          {g.fields.map(f => (
            <View key={f.key} style={{ marginBottom: spacing.sm }}>
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
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.signal },
    eyebrow: { color: colors.signal, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 19, fontWeight: '700', marginTop: 2 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    iconBtnGlyph: { color: colors.ink, fontSize: 16 },

    overviewRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    overviewCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center' },
    overviewValue: { color: colors.ink, fontSize: 17, fontWeight: '700' },
    overviewLabel: { color: colors.muted, fontSize: 9, letterSpacing: 0.6, marginTop: 3 },

    tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.sm, flexGrow: 0 },
    tabBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    tabBtnOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    tabText: { color: colors.muted, fontSize: 11.5, fontWeight: '700' },
    tabTextOn: { color: colors.signalInk },
    tabBadge: { backgroundColor: colors.ember, borderRadius: radius.pill, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
    tabBadgeText: { color: '#fff', fontSize: 9.5, fontWeight: '700' },

    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    emptyWrap: { alignItems: 'center', marginTop: spacing.xxl * 2 },
    emptyGlyph: { fontSize: 32, color: colors.jade, marginBottom: spacing.sm },
    empty: { color: colors.muted, fontSize: 13, textAlign: 'center' },

    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTopLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, flex: 1, marginRight: spacing.sm },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
    cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardSub: { color: colors.muted, fontSize: 11.5, marginTop: 2 },
    cardAddress: { color: colors.signal, fontSize: 11, marginTop: 4, fontFamily: 'monospace' },
    cardAmt: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    autoChip: { backgroundColor: 'rgba(226,163,58,0.16)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    autoChipText: { color: colors.signal, fontSize: 9.5, fontWeight: '700' },

    rejectBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.ember },
    rejectText: { color: colors.ember, fontWeight: '700', fontSize: 12.5 },
    approveBtn: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.jade },
    approveText: { color: '#fff', fontWeight: '700', fontSize: 12.5 },
    adjustBtn: { marginTop: spacing.sm, alignItems: 'center', padding: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface2 },
    adjustBtnText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
    adjustLink: { marginTop: 4 },
    adjustLinkText: { color: colors.signal, fontWeight: '700', fontSize: 11.5 },

    searchWrap: { marginBottom: spacing.md },
    searchInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.ink, fontSize: 13.5 },
    userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    adminChip: { backgroundColor: 'rgba(226,163,58,0.16)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 1 },
    adminChipText: { color: colors.signal, fontSize: 9, fontWeight: '700' },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
    modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: spacing.xs },
    modalHint: { color: colors.muted, fontSize: 11, marginBottom: spacing.md },
    input: { backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.sm },
    modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    modalCancel: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
    modalCancelText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
    modalSubmit: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.signal },
    modalSubmitText: { color: colors.signalInk, fontWeight: '700', fontSize: 13 },

    sectionHead: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
    barRow: { marginBottom: spacing.md },
    barRowTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    breakdownLabel: { color: colors.ink, fontSize: 12.5, textTransform: 'capitalize', fontWeight: '600' },
    breakdownValue: { color: colors.muted, fontSize: 11.5 },
    barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surface2, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3, backgroundColor: colors.signal },

    fieldHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
  });
}
