import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Switch, Alert, Share } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency, CURRENCIES } from '../currency/CurrencyContext';
import { useBalanceVisibility } from '../wallet/BalanceVisibilityContext';
import { useAppLock } from '../security/AppLockContext';
import { checkPushPermissionGranted, requestPushPermissionAndToken, promptToOpenSettingsForNotifications } from '../notifications';
import { APP_VERSION } from '../appVersion';
import { checkForUpdate, UpdateInfo } from '../updateCheck';
import UpdateModal from '../components/UpdateModal';
import ScreenHeader from '../components/ScreenHeader';
import type { ScreenKey } from '../components/Drawer';

type SubScreen =
  | 'root'
  | 'profile'
  | 'password'
  | 'nin'
  | 'referrals'
  | 'reports'
  | 'legal'
  | 'support'
  | 'currency';

function Row({
  icon,
  label,
  colors,
  onPress,
  right,
  danger,
}: {
  icon: string;
  label: string;
  colors: ThemeColors;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const styles = getStyles(colors);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.6}>
      <View style={styles.rowLeft}>
        <View style={styles.rowIcon}>
          <Text style={styles.rowIconGlyph}>{icon}</Text>
        </View>
        <Text style={[styles.rowLabel, danger && { color: colors.ember }]}>{label}</Text>
      </View>
      {right ?? (onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({
  onBack,
  colors,
  onNavigate,
}: {
  onBack: () => void;
  colors: ThemeColors;
  onNavigate: (key: ScreenKey) => void;
}) {
  const [sub, setSub] = useState<SubScreen>('root');

  if (sub === 'profile') return <ProfileScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'password') return <PasswordScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'nin') return <NinScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'referrals') return <ReferralsScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'reports') return <ReportsScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'legal') return <LegalScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'support') return <SupportScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'currency') return <CurrencyScreen onBack={() => setSub('root')} colors={colors} />;

  return <RootSettings onBack={onBack} colors={colors} onGoTo={setSub} onNavigate={onNavigate} />;
}

function RootSettings({
  onBack,
  colors,
  onGoTo,
  onNavigate,
}: {
  onBack: () => void;
  colors: ThemeColors;
  onGoTo: (s: SubScreen) => void;
  onNavigate: (key: ScreenKey) => void;
}) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const { currency } = useCurrency();
  const { balanceHidden, setBalanceHidden } = useBalanceVisibility();
  const appLock = useAppLock();
  const styles = getStyles(colors);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [checkedUpToDate, setCheckedUpToDate] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    checkPushPermissionGranted().then(setPushEnabled);
  }, []);

  async function togglePush(value: boolean) {
    if (value) {
      const granted = await requestPushPermissionAndToken(token => {
        api.saveFcmToken(token).catch(() => {});
      });
      setPushEnabled(granted);
      if (!granted) promptToOpenSettingsForNotifications();
    } else {
      setPushEnabled(false);
      api.saveFcmToken(null).catch(() => {});
    }
  }

  async function onCheckForUpdate() {
    setCheckingUpdate(true);
    setCheckedUpToDate(false);
    try {
      const result = await checkForUpdate();
      if (result) setUpdate(result);
      else setCheckedUpToDate(true);
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <Text style={styles.sectionHead}>ACCOUNT</Text>
        <View style={styles.card}>
          <Row icon="☺" label="My Profile" colors={colors} onPress={() => onGoTo('profile')} />
          <Row
            icon="🏦"
            label="Payment Details"
            colors={colors}
            onPress={() => onNavigate('payment')}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {user?.payoutAccountNumber ? <Text style={styles.rowValue}>Set ✓</Text> : null}
                <Text style={styles.chevron}>›</Text>
              </View>
            }
          />
          <Row icon="▤" label="Reports" colors={colors} onPress={() => onGoTo('reports')} />
          <Row icon="↗" label="Referrals" colors={colors} onPress={() => onGoTo('referrals')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="◐" label="Help & Support" colors={colors} onPress={() => onGoTo('support')} />
          </View>
        </View>

        <Text style={styles.sectionHead}>PREFERENCE</Text>
        <View style={styles.card}>
          <Row
            icon="☾"
            label="Dark Mode"
            colors={colors}
            right={<Switch value={mode === 'dark'} onValueChange={toggleMode} trackColor={{ true: colors.signal, false: colors.line }} thumbColor="#fff" />}
          />
          <Row
            icon="☺"
            label={appLock.supported ? 'Biometric Lock' : 'Biometric Lock (unsupported on this device)'}
            colors={colors}
            right={
              <Switch
                value={appLock.enabled}
                disabled={!appLock.supported}
                onValueChange={async v => {
                  if (v) {
                    const ok = await appLock.unlock();
                    if (!ok) return;
                  }
                  appLock.setEnabled(v);
                }}
                trackColor={{ true: colors.signal, false: colors.line }}
                thumbColor="#fff"
              />
            }
          />
          <Row
            icon="🔔"
            label="Push Notifications"
            colors={colors}
            right={<Switch value={pushEnabled} onValueChange={togglePush} trackColor={{ true: colors.signal, false: colors.line }} thumbColor="#fff" />}
          />
          <Row
            icon="$"
            label="Currency"
            colors={colors}
            onPress={() => onGoTo('currency')}
            right={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={styles.rowValue}>{currency}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            }
          />
          <View style={{ borderBottomWidth: 0 }}>
            <Row
              icon="◉"
              label="Hide Balance"
              colors={colors}
              right={<Switch value={balanceHidden} onValueChange={setBalanceHidden} trackColor={{ true: colors.signal, false: colors.line }} thumbColor="#fff" />}
            />
          </View>
        </View>

        <Text style={styles.sectionHead}>PRIVACY & SECURITY</Text>
        <View style={styles.card}>
          <Row icon="⚿" label="Reset Password" colors={colors} onPress={() => onGoTo('password')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row
              icon="◐"
              label={user?.ninStatus === 'verified' ? 'NIN Verified ✓' : user?.ninStatus === 'pending' ? 'NIN Pending Review' : 'Verify NIN'}
              colors={colors}
              onPress={() => onGoTo('nin')}
            />
          </View>
        </View>

        <Text style={styles.sectionHead}>MORE</Text>
        <View style={styles.card}>
          <Row icon="▤" label="Legal" colors={colors} onPress={() => onGoTo('legal')} />
          <Row
            icon="⬆️"
            label={checkingUpdate ? 'Checking…' : 'Check for Updates'}
            colors={colors}
            onPress={onCheckForUpdate}
            right={checkedUpToDate ? <Text style={styles.rowValue}>Up to date ✓</Text> : undefined}
          />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="⎋" label="Logout" colors={colors} onPress={logout} danger />
          </View>
        </View>

        <Text style={styles.version}>Version {APP_VERSION}</Text>
      </ScrollView>

      <UpdateModal update={update} onDismiss={() => setUpdate(null)} colors={colors} />
    </View>
  );
}

function ProfileScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateProfile({ name, email, phone });
      await refreshUser();
      setStatus('Profile updated.');
      setStatusOk(true);
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Profile" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.flabel}>FULL NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>EMAIL</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>PHONE NUMBER</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={t => setPhone(t.replace(/[^0-9+]/g, ''))}
            keyboardType="phone-pad"
            placeholder="e.g. 08012345678"
            placeholderTextColor={colors.muted}
          />
        </View>
        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}
        <TouchableOpacity style={styles.cta} onPress={save} disabled={saving}>
          <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function PasswordScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmNext, setConfirmNext] = useState('');
  const [reveal, setReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  const mismatch = next.length > 0 && confirmNext.length > 0 && next !== confirmNext;
  const canSave = !!current && !!next && next === confirmNext;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);
    try {
      await api.changePassword(current, next);
      setStatus('Password changed.');
      setStatusOk(true);
      setCurrent('');
      setNext('');
      setConfirmNext('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Reset Password" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.flabel}>CURRENT PASSWORD</Text>
          <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry={!reveal} placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>NEW PASSWORD</Text>
          <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry={!reveal} placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>CONFIRM NEW PASSWORD</Text>
          <TextInput style={styles.input} value={confirmNext} onChangeText={setConfirmNext} secureTextEntry={!reveal} placeholderTextColor={colors.muted} />
        </View>
        <TouchableOpacity style={styles.revealRow} onPress={() => setReveal(r => !r)}>
          <Text style={styles.revealText}>{reveal ? 'Hide passwords' : 'Show passwords'}</Text>
        </TouchableOpacity>
        {mismatch && <Text style={[styles.status, styles.statusError]}>New passwords don't match.</Text>}
        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}
        <TouchableOpacity style={[styles.cta, !canSave && { opacity: 0.5 }]} onPress={save} disabled={saving || !canSave}>
          <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Change Password'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function NinScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [nin, setNin] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);

  async function submit() {
    setSaving(true);
    setStatus(null);
    try {
      await api.submitNin(nin);
      await refreshUser();
      setStatus('Submitted — an admin will review your NIN shortly.');
      setStatusOk(true);
      setNin('');
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Verify NIN" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.modalHint}>Current status: {user?.ninStatus ?? 'unverified'}</Text>
        <View style={styles.field}>
          <Text style={styles.flabel}>NATIONAL IDENTIFICATION NUMBER</Text>
          <TextInput style={styles.input} value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} placeholder="11 digits" placeholderTextColor={colors.muted} />
        </View>
        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}
        <TouchableOpacity style={styles.cta} onPress={submit} disabled={saving || nin.length !== 11}>
          <Text style={styles.ctaText}>{saving ? 'Submitting…' : 'Submit for Verification'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function CurrencyScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { currency, setCurrency } = useCurrency();
  const styles = getStyles(colors);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Currency" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.modalHint}>
          Choose how prices are displayed across the app. Your NGN wallet balance itself never changes — this only
          affects how it's shown.
        </Text>
        <View style={styles.card}>
          {CURRENCIES.map((c, idx) => (
            <View key={c.code} style={idx === CURRENCIES.length - 1 ? { borderBottomWidth: 0 } : undefined}>
              <Row
                icon={c.symbol}
                label={`${c.code} — ${c.label}`}
                colors={colors}
                onPress={() => setCurrency(c.code)}
                right={currency === c.code ? <Text style={styles.currencyCheck}>✓</Text> : null}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ReferralsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const code = user?.referralCode ?? '—';

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Referrals" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.modalHint}>Share your code — friends who sign up with it help you both.</Text>
        <View style={styles.referralCard}>
          <Text style={styles.referralCode}>{code}</Text>
        </View>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => Share.share({ message: `Join me on Finance App! Use my referral code ${code} when you sign up.` })}>
          <Text style={styles.ctaText}>Share Code</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ReportsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  const { formatNgn } = useCurrency();
  const [txns, setTxns] = useState<any[]>([]);

  useEffect(() => {
    api.transactions().then(setTxns);
  }, []);

  const successful = txns.filter(t => t.status === 'Successful');
  const spent = successful.filter(t => t.amount_ngn < 0).reduce((s, t) => s + Math.abs(t.amount_ngn), 0);
  const received = successful.filter(t => t.amount_ngn > 0).reduce((s, t) => s + t.amount_ngn, 0);
  const byType: Record<string, number> = {};
  successful.forEach(t => (byType[t.type] = (byType[t.type] ?? 0) + Math.abs(t.amount_ngn)));

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Reports" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.flabel}>TOTAL SPENT</Text>
            <Text style={styles.statValue}>{formatNgn(spent)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.flabel}>TOTAL RECEIVED</Text>
            <Text style={styles.statValue}>{formatNgn(received)}</Text>
          </View>
        </View>
        <Text style={styles.sectionHead}>BY CATEGORY</Text>
        {Object.entries(byType).length === 0 && <Text style={styles.modalHint}>No completed transactions yet.</Text>}
        {Object.entries(byType).map(([type, total]) => (
          <View key={type} style={styles.row}>
            <Text style={[styles.rowLabel, { textTransform: 'capitalize' }]}>{type}</Text>
            <Text style={styles.rowLabel}>{formatNgn(total as number)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function LegalScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Legal" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.sectionHead}>TERMS OF SERVICE</Text>
        <Text style={styles.legalText}>
          By using this app you agree that all deposits, withdrawals, and crypto trades are reviewed and
          manually confirmed by our team before funds move. Rates shown for crypto and gift cards are
          indicative and may change at confirmation. We are not liable for funds sent to an incorrect
          wallet address.
        </Text>
        <Text style={styles.sectionHead}>PRIVACY POLICY</Text>
        <Text style={styles.legalText}>
          We store your name, email, and transaction history to operate your wallet. We never sell your
          data. NIN submissions are used solely for identity verification and are visible only to admins.
        </Text>
      </ScrollView>
    </View>
  );
}

function SupportScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const styles = getStyles(colors);
  return (
    <View style={styles.screen}>
      <ScreenHeader title="Help & Support" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.modalHint}>
          Something wrong with a transaction, or a question about the app? Reach out and an admin will get
          back to you.
        </Text>
        <View style={styles.card}>
          <Row icon="✉" label="support@financeapp.com" colors={colors} />
        </View>
      </ScrollView>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    profileCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.signal, alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: colors.signalInk, fontWeight: '700', fontSize: 18 },
    name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    email: { color: colors.muted, fontSize: 12, marginTop: 2 },
    sectionHead: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.sm },
    card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, marginBottom: spacing.lg, overflow: 'hidden', paddingHorizontal: spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginRight: spacing.sm },
    rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    rowIconGlyph: { color: colors.ink, fontSize: 15 },
    rowLabel: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
    chevron: { color: colors.muted, fontSize: 18 },
    rowValue: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    currencyCheck: { color: colors.jade, fontSize: 16, fontWeight: '700' },
    version: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    revealRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
    revealText: { color: colors.signal, fontSize: 12, fontWeight: '700' },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.md },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    modalHint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.lg },
    referralCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.lg },
    referralCode: { color: colors.signal, fontSize: 26, fontWeight: '700', letterSpacing: 2 },
    statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
    statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg },
    statValue: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: spacing.xs },
    legalText: { color: colors.muted, fontSize: 12.5, lineHeight: 19, marginBottom: spacing.lg },
  });
}
