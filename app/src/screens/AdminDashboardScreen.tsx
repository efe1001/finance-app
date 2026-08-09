import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, RefreshControl, Modal, Alert, Clipboard, Linking, FlatList, ActivityIndicator } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { NGN_PER_USD } from '../currency/CurrencyContext';
import IconBadge from '../components/IconBadge';

type Tab = 'approvals' | 'users' | 'nin' | 'stats' | 'wallets' | 'rates' | 'settings';

type PendingTxn = {
  id: number;
  type: string;
  title: string;
  subtitle: string | null;
  amount_ngn: number;
  status: string;
  address: string | null;
  has_receipt: boolean;
  admin_id: number | null;
  admin_name: string | null;
  user_name: string;
  user_email: string;
};

// 'Processing' covers automated withdrawals sent to Flutterwave but not yet
// confirmed complete - they never sit 'Pending' the way manually-approved
// transaction types do, so without this filter admins would have no way to
// see in-flight withdrawals here at all.
const STATUS_FILTERS = ['Pending', 'Processing', 'Successful', 'Rejected'] as const;

type AdminUser = {
  id: number;
  name: string;
  email: string;
  wallet_balance_ngn: number;
  is_admin: boolean;
};

type Overview = { totalUsers: number; totalBalanceNgn: number; pendingApprovals: number; totalRevenueNgn: number };

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'approvals', label: 'Approvals', icon: 'approvals' },
  { key: 'users', label: 'Users', icon: 'users' },
  { key: 'nin', label: 'NIN Review', icon: 'approvals' },
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
      setOverview({ totalUsers: s.totalUsers, totalBalanceNgn: s.totalBalanceNgn, pendingApprovals: s.pendingApprovals, totalRevenueNgn: s.totalRevenueNgn }),
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
          <Text style={styles.overviewLabel}>OWED TO USERS</Text>
        </View>
        <View style={[styles.overviewCard, { flex: 1.4, borderColor: colors.jade }]}>
          <Text style={[styles.overviewValue, { color: colors.jade }]} numberOfLines={1}>
            {overview ? `₦${overview.totalRevenueNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
          </Text>
          <Text style={styles.overviewLabel}>YOUR REVENUE</Text>
        </View>
      </View>
      <Text style={styles.revenueNote}>
        "Owed to users" is what's in everyone's wallets - not yours to withdraw. "Your Revenue" (bills markup + swap
        spread) is the only figure here that's safely yours.
      </Text>

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
      {tab === 'nin' && <NinReviewTab colors={colors} />}
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
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('Pending');
  const [items, setItems] = useState<PendingTxn[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  function copyAddress(id: number, address: string) {
    Clipboard.setString(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(c => (c === id ? null : c)), 1800);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.admin.pendingTransactions(statusFilter));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

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
      <View style={styles.statusFilterRow}>
        {STATUS_FILTERS.map(s => (
          <TouchableOpacity key={s} style={[styles.statusChip, statusFilter === s && styles.statusChipOn]} onPress={() => setStatusFilter(s)}>
            <Text style={[styles.statusChipText, statusFilter === s && styles.statusChipTextOn]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {items.length === 0 && !loading && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>✓</Text>
          <Text style={styles.empty}>
            {statusFilter === 'Pending' ? 'All caught up — no pending approvals.' : `No ${statusFilter.toLowerCase()} transactions.`}
          </Text>
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
                  {item.address ? (
                    <View style={styles.addressRow}>
                      <Text style={styles.cardAddress} numberOfLines={1} ellipsizeMode="middle">{item.address}</Text>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => copyAddress(item.id, item.address!)}>
                        <Text style={styles.copyBtnText}>{copiedId === item.id ? '✓' : 'Copy'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {item.has_receipt && (
                    <TouchableOpacity onPress={() => Linking.openURL(api.admin.receiptFileUrl(item.id))}>
                      <Text style={styles.receiptLink}>📎 View Receipt</Text>
                    </TouchableOpacity>
                  )}
                  {item.admin_name && (
                    <Text style={styles.cardSub}>
                      {item.status === 'Successful' ? 'Approved' : 'Rejected'} by {item.admin_name}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={[styles.cardAmt, item.amount_ngn < 0 ? { color: colors.ember } : { color: colors.jade }]}>
                {item.amount_ngn < 0 ? '-' : '+'}₦{Math.abs(item.amount_ngn).toLocaleString()}
              </Text>
            </View>
            {statusFilter === 'Pending' && (
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.rejectBtn} disabled={busyId === item.id} onPress={() => reject(item.id)}>
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.approveBtn} disabled={busyId === item.id} onPress={() => approve(item.id)}>
                  <Text style={styles.approveText}>{busyId === item.id ? '…' : 'Approve'}</Text>
                </TouchableOpacity>
              </View>
            )}
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

type NinUser = { id: number; name: string; email: string; nin: string | null; nin_status: string };

function NinReviewTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [users, setUsers] = useState<NinUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all: NinUser[] = await api.admin.users();
      setUsers(all.filter(u => u.nin_status === 'pending'));
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
      await api.admin.approveNin(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    setBusyId(id);
    try {
      await api.admin.rejectNin(id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.signal} />}>
      {users.length === 0 && !loading && (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyGlyph}>✓</Text>
          <Text style={styles.empty}>No pending NIN submissions.</Text>
        </View>
      )}
      {users.map(u => (
        <View key={u.id} style={styles.card}>
          <Text style={styles.cardTitle}>{u.name}</Text>
          <Text style={styles.cardSub}>{u.email}</Text>
          <Text style={styles.cardAddress}>NIN: {u.nin}</Text>
          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.rejectBtn} disabled={busyId === u.id} onPress={() => reject(u.id)}>
              <Text style={styles.rejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveBtn} disabled={busyId === u.id} onPress={() => approve(u.id)}>
              <Text style={styles.approveText}>{busyId === u.id ? '…' : 'Verify'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

type Bank = { code: string; name: string };

function RevenueWithdrawCard({ colors, availableRevenue, onWithdrawn }: { colors: ThemeColors; availableRevenue: number; onWithdrawn: () => void }) {
  const styles = getStyles(colors);
  const [amount, setAmount] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<{ id: number; detail: string; amountNgn: number; createdAt: string }[]>([]);

  const loadHistory = useCallback(() => {
    api.admin.revenueWithdrawals().then(setHistory).catch(() => {});
  }, []);

  useEffect(() => {
    api.flutterwave.banks().then(setBanks).catch(() => {});
    loadHistory();
  }, [loadHistory]);

  const resolveAccount = useCallback(async (num: string, b: Bank) => {
    setResolving(true);
    setResolveError(null);
    setResolvedName(null);
    try {
      const res = await api.flutterwave.resolveAccount(num, b.code);
      setResolvedName(res.accountName);
    } catch (e: any) {
      setResolveError(e.message || 'Could not resolve account name');
    } finally {
      setResolving(false);
    }
  }, []);

  useEffect(() => {
    if (accountNumber.length === 10 && bank) resolveAccount(accountNumber, bank);
    else {
      setResolvedName(null);
      setResolveError(null);
    }
  }, [accountNumber, bank, resolveAccount]);

  const amountNgn = parseFloat(amount || '0');
  const canSubmit = amountNgn > 0 && !!bank && accountNumber.length === 10 && !!resolvedName && !resolving;
  const filteredBanks = banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()));

  async function doSubmit() {
    if (!bank) return;
    setSubmitting(true);
    try {
      const res = await api.admin.withdrawRevenue({
        amountNgn,
        bankName: bank.name,
        bankCode: bank.code,
        accountNumber,
        accountName: resolvedName || undefined,
      });
      Alert.alert('Logged', res.message);
      setAmount('');
      setAccountNumber('');
      setBank(null);
      setResolvedName(null);
      loadHistory();
      onWithdrawn();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function submit() {
    if (!canSubmit || !bank) return;
    Alert.alert(
      'Log this withdrawal?',
      `This records ₦${amountNgn.toLocaleString()} to ${resolvedName} · ${bank.name} · ${accountNumber} as taken out. It does not move real money - you still need to send it yourself from Flutterwave.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log It', onPress: doSubmit },
      ],
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.fieldHeadRow}>
        <IconBadge name="vault" size={32} />
        <Text style={styles.sectionHead}>WITHDRAW YOUR REVENUE</Text>
      </View>
      <Text style={styles.dangerText}>
        Logs a withdrawal of your earned revenue to a bank account - never touches any user's balance. You still
        send the real money yourself from your Flutterwave dashboard; this just keeps a clean record here.
        Available: ₦{availableRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
      </Text>

      <Text style={styles.flabel}>AMOUNT (₦)</Text>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TextInput style={[styles.input, { flex: 1 }]} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.muted} />
        <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(availableRevenue))}>
          <Text style={styles.maxBtnText}>Use All Revenue</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.flabel}>BANK</Text>
      <TouchableOpacity style={[styles.input, { marginBottom: spacing.sm }]} onPress={() => setBankModalVisible(true)}>
        <Text style={bank ? { color: colors.ink } : { color: colors.muted }}>{bank ? bank.name : 'Select Bank'}</Text>
      </TouchableOpacity>

      <Text style={styles.flabel}>ACCOUNT NUMBER</Text>
      <TextInput
        style={[styles.input, { marginBottom: spacing.sm }]}
        value={accountNumber}
        onChangeText={t => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
        keyboardType="number-pad"
        maxLength={10}
        placeholderTextColor={colors.muted}
      />

      {resolving && (
        <View style={styles.resolveRow}>
          <ActivityIndicator size="small" color={colors.signal} />
          <Text style={styles.resolveText}>Verifying account…</Text>
        </View>
      )}
      {resolvedName && <Text style={styles.resolvedName}>✓ {resolvedName}</Text>}
      {resolveError && !resolving && <Text style={styles.resolveErrorText}>{resolveError}</Text>}

      <TouchableOpacity style={[styles.cta, (!canSubmit || submitting) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || submitting}>
        <Text style={styles.ctaText}>{submitting ? 'Logging…' : 'Log Withdrawal'}</Text>
      </TouchableOpacity>

      {history.length > 0 && (
        <>
          <Text style={[styles.flabel, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>RECENT WITHDRAWALS</Text>
          {history.map(h => (
            <View key={h.id} style={styles.row}>
              <Text style={[styles.rowLabel, { flex: 1 }]} numberOfLines={1}>{h.detail}</Text>
              <Text style={styles.rowLabel}>₦{h.amountNgn.toLocaleString()}</Text>
            </View>
          ))}
        </>
      )}

      <Modal visible={bankModalVisible} animationType="slide" onRequestClose={() => setBankModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Select Bank</Text>
            <TouchableOpacity onPress={() => setBankModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={{ padding: spacing.lg }}>
            <TextInput style={styles.input} value={bankSearch} onChangeText={setBankSearch} placeholder="Search banks…" placeholderTextColor={colors.muted} />
          </View>
          <FlatList
            data={filteredBanks}
            keyExtractor={b => b.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setBank(item);
                  setBankModalVisible(false);
                  setBankSearch('');
                }}>
                <Text style={styles.rowLabel}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

function StatsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [stats, setStats] = useState<any>(null);

  const load = useCallback(() => {
    api.admin.stats().then(setStats);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!stats) return <View style={styles.content} />;

  const maxCount = Math.max(1, ...stats.breakdown.map((r: any) => r.count));

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <RevenueWithdrawCard colors={colors} availableRevenue={stats.totalRevenueNgn} onWithdrawn={load} />
      <Text style={[styles.sectionHead, { marginTop: spacing.lg }]}>ACTIVITY BY TYPE & STATUS</Text>
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

type Tier = { id: number; brand: string; minUsd: number; maxUsd: number | null; percentage: number };

function tierPayout(faceValueUsd: number, percentage: number) {
  const ngn = faceValueUsd * NGN_PER_USD * (percentage / 100);
  return { ngn, usd: ngn / NGN_PER_USD };
}

function findTier(tiers: Tier[], faceValueUsd: number): Tier | null {
  const matches = tiers.filter(t => faceValueUsd >= t.minUsd && (t.maxUsd == null || faceValueUsd <= t.maxUsd));
  if (!matches.length) return null;
  return matches.reduce((best, t) => (t.minUsd > best.minUsd ? t : best), matches[0]);
}

function RatesTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [edited, setEdited] = useState<Record<number, { minUsd: string; maxUsd: string; percentage: string }>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newTierForBrand, setNewTierForBrand] = useState<Record<string, { minUsd: string; maxUsd: string; percentage: string }>>({});
  const [addingBrand, setAddingBrand] = useState<string | null>(null);
  const [newBrand, setNewBrand] = useState('');
  const [newBrandTier, setNewBrandTier] = useState({ minUsd: '0', maxUsd: '', percentage: '' });
  const [addingNewBrand, setAddingNewBrand] = useState(false);

  const [calcBrand, setCalcBrand] = useState<string | null>(null);
  const [calcAmount, setCalcAmount] = useState('100');

  const load = useCallback(() => {
    api.admin.giftCardTiers().then(list => {
      setTiers(list);
      const e: typeof edited = {};
      list.forEach(t => (e[t.id] = { minUsd: String(t.minUsd), maxUsd: t.maxUsd == null ? '' : String(t.maxUsd), percentage: String(t.percentage) }));
      setEdited(e);
      if (!calcBrand && list.length) setCalcBrand(list[0].brand);
    });
  }, [calcBrand]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byBrand: Record<string, Tier[]> = {};
  tiers.forEach(t => {
    if (!byBrand[t.brand]) byBrand[t.brand] = [];
    byBrand[t.brand].push(t);
  });
  Object.values(byBrand).forEach(list => list.sort((a, b) => a.minUsd - b.minUsd));
  const brands = Object.keys(byBrand).sort();

  async function saveTier(id: number) {
    const e = edited[id];
    if (!e) return;
    setSavingId(id);
    try {
      await api.admin.updateGiftCardTier(id, {
        minUsd: Number(e.minUsd),
        maxUsd: e.maxUsd === '' ? null : Number(e.maxUsd),
        percentage: Number(e.percentage),
      });
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function removeTier(id: number) {
    setSavingId(id);
    try {
      await api.admin.deleteGiftCardTier(id);
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function addTierToBrand(brand: string) {
    const f = newTierForBrand[brand];
    if (!f?.percentage) return;
    setAddingBrand(brand);
    try {
      await api.admin.addGiftCardTier({
        brand,
        minUsd: Number(f.minUsd || '0'),
        maxUsd: f.maxUsd === '' || f.maxUsd == null ? null : Number(f.maxUsd),
        percentage: Number(f.percentage),
      });
      setNewTierForBrand(s => ({ ...s, [brand]: { minUsd: '', maxUsd: '', percentage: '' } }));
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingBrand(null);
    }
  }

  async function addNewBrand() {
    if (!newBrand || !newBrandTier.percentage) return;
    setAddingNewBrand(true);
    try {
      await api.admin.addGiftCardTier({
        brand: newBrand,
        minUsd: Number(newBrandTier.minUsd || '0'),
        maxUsd: newBrandTier.maxUsd === '' ? null : Number(newBrandTier.maxUsd),
        percentage: Number(newBrandTier.percentage),
      });
      setCalcBrand(newBrand);
      setNewBrand('');
      setNewBrandTier({ minUsd: '0', maxUsd: '', percentage: '' });
      load();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setAddingNewBrand(false);
    }
  }

  const calcTiers = calcBrand ? byBrand[calcBrand] ?? [] : [];
  const calcMatch = findTier(calcTiers, Number(calcAmount || '0'));
  const calcResult = calcMatch ? tierPayout(Number(calcAmount || '0'), calcMatch.percentage) : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
      <Text style={styles.modalHint}>
        Gift card payouts are tiered by face value — bigger cards get a better percentage. Set the ranges per brand below.
      </Text>

      <Text style={styles.sectionHead}>TRY IT — SEE WHAT A USER WOULD SEE</Text>
      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {brands.map(b => (
            <TouchableOpacity key={b} style={[styles.calcBrandChip, calcBrand === b && styles.calcBrandChipOn]} onPress={() => setCalcBrand(b)}>
              <Text style={[styles.calcBrandChipText, calcBrand === b && styles.calcBrandChipTextOn]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={styles.flabel}>SAMPLE CARD VALUE (USD)</Text>
        <TextInput style={styles.input} value={calcAmount} onChangeText={setCalcAmount} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
        {calcMatch && calcResult ? (
          <View style={styles.calcResult}>
            <Text style={styles.calcResultText}>
              Matches the {tierRangeLabel(calcMatch)} tier at {calcMatch.percentage}%
            </Text>
            <Text style={styles.calcResultBig}>₦{calcResult.ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
            <Text style={styles.calcResultSub}>≈ ${calcResult.usd.toFixed(2)} — this is exactly what the user's "You Receive" field will show</Text>
          </View>
        ) : (
          <Text style={styles.calcNoMatch}>No tier configured for that amount — the user would see an error.</Text>
        )}
      </View>

      {brands.map(brand => (
        <View key={brand}>
          <Text style={styles.sectionHead}>{brand.toUpperCase()}</Text>
          {byBrand[brand].map(t => {
            const e = edited[t.id];
            const previewPct = Number(e?.percentage || t.percentage);
            const sample = Math.max(t.minUsd, 1);
            const preview = tierPayout(sample, previewPct);
            return (
              <View key={t.id} style={styles.card}>
                <View style={styles.tierEditRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flabel}>MIN $</Text>
                    <TextInput style={styles.input} value={e?.minUsd ?? ''} onChangeText={v => setEdited(s => ({ ...s, [t.id]: { ...s[t.id], minUsd: v } }))} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flabel}>MAX $ (blank = no cap)</Text>
                    <TextInput style={styles.input} value={e?.maxUsd ?? ''} onChangeText={v => setEdited(s => ({ ...s, [t.id]: { ...s[t.id], maxUsd: v } }))} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.flabel}>PAYOUT %</Text>
                    <TextInput style={styles.input} value={e?.percentage ?? ''} onChangeText={v => setEdited(s => ({ ...s, [t.id]: { ...s[t.id], percentage: v } }))} keyboardType="decimal-pad" placeholderTextColor={colors.muted} />
                  </View>
                </View>
                {previewPct > 0 && (
                  <Text style={styles.tierPreview}>e.g. a ${sample} card here → ₦{preview.ngn.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${preview.usd.toFixed(2)})</Text>
                )}
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
                  <TouchableOpacity style={[styles.adjustBtn, { flex: 1 }]} onPress={() => saveTier(t.id)} disabled={savingId === t.id}>
                    <Text style={styles.adjustBtnText}>{savingId === t.id ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, { flex: 1 }]} onPress={() => removeTier(t.id)} disabled={savingId === t.id}>
                    <Text style={styles.rejectText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={styles.card}>
            <Text style={styles.flabel}>ADD ANOTHER TIER FOR {brand.toUpperCase()}</Text>
            <View style={styles.tierEditRow}>
              <TextInput style={[styles.input, styles.tierAddInput]} value={newTierForBrand[brand]?.minUsd ?? ''} onChangeText={v => setNewTierForBrand(s => ({ ...s, [brand]: { minUsd: v, maxUsd: s[brand]?.maxUsd ?? '', percentage: s[brand]?.percentage ?? '' } }))} placeholder="Min $" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.tierAddInput]} value={newTierForBrand[brand]?.maxUsd ?? ''} onChangeText={v => setNewTierForBrand(s => ({ ...s, [brand]: { minUsd: s[brand]?.minUsd ?? '', maxUsd: v, percentage: s[brand]?.percentage ?? '' } }))} placeholder="Max $" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
              <TextInput style={[styles.input, styles.tierAddInput]} value={newTierForBrand[brand]?.percentage ?? ''} onChangeText={v => setNewTierForBrand(s => ({ ...s, [brand]: { minUsd: s[brand]?.minUsd ?? '', maxUsd: s[brand]?.maxUsd ?? '', percentage: v } }))} placeholder="%" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
            </View>
            <TouchableOpacity style={styles.cta} onPress={() => addTierToBrand(brand)} disabled={addingBrand === brand || !newTierForBrand[brand]?.percentage}>
              <Text style={styles.ctaText}>{addingBrand === brand ? 'Adding…' : 'Add Tier'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionHead}>ADD NEW CARD BRAND</Text>
      <View style={styles.card}>
        <Text style={styles.flabel}>BRAND NAME</Text>
        <TextInput style={styles.input} value={newBrand} onChangeText={setNewBrand} placeholder="e.g. Vanilla" placeholderTextColor={colors.muted} />
        <View style={[styles.tierEditRow, { marginTop: spacing.sm }]}>
          <TextInput style={[styles.input, styles.tierAddInput]} value={newBrandTier.minUsd} onChangeText={v => setNewBrandTier(s => ({ ...s, minUsd: v }))} placeholder="Min $" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, styles.tierAddInput]} value={newBrandTier.maxUsd} onChangeText={v => setNewBrandTier(s => ({ ...s, maxUsd: v }))} placeholder="Max $" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
          <TextInput style={[styles.input, styles.tierAddInput]} value={newBrandTier.percentage} onChangeText={v => setNewBrandTier(s => ({ ...s, percentage: v }))} placeholder="%" placeholderTextColor={colors.muted} keyboardType="decimal-pad" />
        </View>
        <TouchableOpacity style={styles.cta} onPress={addNewBrand} disabled={addingNewBrand || !newBrand || !newBrandTier.percentage}>
          <Text style={styles.ctaText}>{addingNewBrand ? 'Adding…' : 'Add Card Brand'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function tierRangeLabel(t: Tier) {
  return t.maxUsd == null ? `$${t.minUsd}+` : `$${t.minUsd}–${t.maxUsd}`;
}

function LimitsTab({ colors }: { colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

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

  function confirmReset() {
    Alert.alert(
      'Reset all balances?',
      "Every user's wallet balance and crypto holdings will be set to 0, and anything pending will be cancelled. Accounts and transaction history stay. This cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: doReset },
      ],
    );
  }

  async function doReset() {
    setResetting(true);
    try {
      const res = await api.admin.resetBalances();
      Alert.alert('Done', res.message);
      setResetConfirmText('');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setResetting(false);
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
    { head: 'REFERRALS', icon: 'users', fields: [
      { key: 'referral_bonus_ngn', label: 'Bonus per referral, both sides (₦) — 0 disables it' },
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

      <View style={[styles.card, { borderColor: colors.ember, marginTop: spacing.xl }]}>
        <View style={styles.fieldHeadRow}>
          <IconBadge name="withdrawal" size={32} />
          <Text style={[styles.sectionHead, { color: colors.ember }]}>DANGER ZONE</Text>
        </View>
        <Text style={styles.dangerText}>
          Want to remove a specific amount from one user instead of resetting everyone? Use "Adjust Balance" on that
          user in the Users tab - it takes any amount (negative to remove) and is tracked the same way as this.
        </Text>
        <Text style={styles.dangerText}>
          This resets every user's wallet balance and crypto holdings to 0, and cancels anything still pending.
          Nothing disappears untracked - each balance is logged as an Admin Debit (visible in that user's history)
          before it's cleared, so it can be credited back the same way any adjustment can. Accounts and transaction
          history are kept. For wiping test data before handing the app to a client - not for routine use.
        </Text>
        <Text style={styles.flabel}>TYPE "RESET" TO ENABLE</Text>
        <TextInput
          style={styles.input}
          value={resetConfirmText}
          onChangeText={setResetConfirmText}
          autoCapitalize="characters"
          placeholder="RESET"
          placeholderTextColor={colors.muted}
        />
        <TouchableOpacity
          style={[styles.dangerCta, (resetConfirmText !== 'RESET' || resetting) && { opacity: 0.4 }]}
          onPress={confirmReset}
          disabled={resetConfirmText !== 'RESET' || resetting}>
          <Text style={styles.ctaText}>{resetting ? 'Resetting…' : 'Reset All Balances'}</Text>
        </TouchableOpacity>
      </View>
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

    overviewRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    revenueNote: { color: colors.muted, fontSize: 10.5, lineHeight: 15, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
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
    cardAddress: { flex: 1, color: colors.signal, fontSize: 11, fontFamily: 'monospace' },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
    copyBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    copyBtnText: { color: colors.ink, fontSize: 10.5, fontWeight: '700' },
    receiptLink: { color: colors.signal, fontSize: 11.5, fontWeight: '700', marginTop: 6 },
    cardAmt: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
    autoChip: { backgroundColor: 'rgba(226,163,58,0.16)', borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
    autoChipText: { color: colors.signal, fontSize: 9.5, fontWeight: '700' },
    statusFilterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    statusChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    statusChipOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    statusChipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    statusChipTextOn: { color: colors.signalInk },

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
    dangerText: { color: colors.muted, fontSize: 11.5, lineHeight: 17, marginBottom: spacing.md },
    dangerCta: { backgroundColor: colors.ember, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    maxBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, justifyContent: 'center' },
    maxBtnText: { color: colors.ink, fontSize: 11.5, fontWeight: '700' },
    resolveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    resolveText: { color: colors.muted, fontSize: 12 },
    resolvedName: { color: colors.jade, fontSize: 13, fontWeight: '700', marginBottom: spacing.sm },
    resolveErrorText: { color: colors.ember, fontSize: 12, marginBottom: spacing.sm },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xxl, borderBottomWidth: 1, borderBottomColor: colors.line },
    modalHeaderTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    modalClose: { color: colors.muted, fontSize: 18 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowLabel: { color: colors.ink, fontSize: 13.5, fontWeight: '600' },

    calcBrandChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
    calcBrandChipOn: { backgroundColor: colors.signal, borderColor: 'transparent' },
    calcBrandChipText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    calcBrandChipTextOn: { color: colors.signalInk },
    calcResult: { backgroundColor: colors.surface2, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.sm },
    calcResultText: { color: colors.muted, fontSize: 11.5 },
    calcResultBig: { color: colors.jade, fontSize: 22, fontWeight: '700', marginTop: spacing.xs },
    calcResultSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
    calcNoMatch: { color: colors.ember, fontSize: 12, marginTop: spacing.sm },
    tierEditRow: { flexDirection: 'row', gap: spacing.sm },
    tierAddInput: { flex: 1 },
    tierPreview: { color: colors.signal, fontSize: 11, marginTop: spacing.xs },
  });
}
