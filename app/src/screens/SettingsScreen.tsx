import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Switch, Alert, Share } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';

type SubScreen =
  | 'root'
  | 'profile'
  | 'password'
  | 'nin'
  | 'referrals'
  | 'reports'
  | 'legal'
  | 'support';

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

export default function SettingsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const [sub, setSub] = useState<SubScreen>('root');

  if (sub === 'profile') return <ProfileScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'password') return <PasswordScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'nin') return <NinScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'referrals') return <ReferralsScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'reports') return <ReportsScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'legal') return <LegalScreen onBack={() => setSub('root')} colors={colors} />;
  if (sub === 'support') return <SupportScreen onBack={() => setSub('root')} colors={colors} />;

  return <RootSettings onBack={onBack} colors={colors} onGoTo={setSub} />;
}

function RootSettings({
  onBack,
  colors,
  onGoTo,
}: {
  onBack: () => void;
  colors: ThemeColors;
  onGoTo: (s: SubScreen) => void;
}) {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const styles = getStyles(colors);
  const [biometrics, setBiometrics] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Profile" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
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
            label="Biometrics"
            colors={colors}
            right={<Switch value={biometrics} onValueChange={setBiometrics} trackColor={{ true: colors.signal, false: colors.line }} thumbColor="#fff" />}
          />
          <View style={{ borderBottomWidth: 0 }}>
            <Row
              icon="◉"
              label="Hide Balance by Default"
              colors={colors}
              right={<Switch value={hideBalance} onValueChange={setHideBalance} trackColor={{ true: colors.signal, false: colors.line }} thumbColor="#fff" />}
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
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="⎋" label="Logout" colors={colors} onPress={logout} danger />
          </View>
        </View>

        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function ProfileScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api.updateProfile({ name, email });
      await refreshUser();
      setStatus('Profile updated.');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="My Profile" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.flabel}>FULL NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>EMAIL</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} />
        </View>
        {status && <Text style={styles.status}>{status}</Text>}
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
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api.changePassword(current, next);
      setStatus('Password changed.');
      setCurrent('');
      setNext('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Reset Password" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.flabel}>CURRENT PASSWORD</Text>
          <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry placeholderTextColor={colors.muted} />
        </View>
        <View style={styles.field}>
          <Text style={styles.flabel}>NEW PASSWORD</Text>
          <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry placeholderTextColor={colors.muted} />
        </View>
        {status && <Text style={styles.status}>{status}</Text>}
        <TouchableOpacity style={styles.cta} onPress={save} disabled={saving || !current || !next}>
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

  async function submit() {
    setSaving(true);
    setStatus(null);
    try {
      await api.submitNin(nin);
      await refreshUser();
      setStatus('Submitted — an admin will review your NIN shortly.');
      setNin('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Verify NIN" onBack={onBack} colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.modalHint}>Current status: {user?.ninStatus ?? 'unverified'}</Text>
        <View style={styles.field}>
          <Text style={styles.flabel}>NATIONAL IDENTIFICATION NUMBER</Text>
          <TextInput style={styles.input} value={nin} onChangeText={setNin} keyboardType="number-pad" maxLength={11} placeholder="11 digits" placeholderTextColor={colors.muted} />
        </View>
        {status && <Text style={styles.status}>{status}</Text>}
        <TouchableOpacity style={styles.cta} onPress={submit} disabled={saving || nin.length !== 11}>
          <Text style={styles.ctaText}>{saving ? 'Submitting…' : 'Submit for Verification'}</Text>
        </TouchableOpacity>
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
      <ScrollView contentContainerStyle={styles.content}>
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.flabel}>TOTAL SPENT</Text>
            <Text style={styles.statValue}>₦{spent.toLocaleString()}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.flabel}>TOTAL RECEIVED</Text>
            <Text style={styles.statValue}>₦{received.toLocaleString()}</Text>
          </View>
        </View>
        <Text style={styles.sectionHead}>BY CATEGORY</Text>
        {Object.entries(byType).length === 0 && <Text style={styles.modalHint}>No completed transactions yet.</Text>}
        {Object.entries(byType).map(([type, total]) => (
          <View key={type} style={styles.row}>
            <Text style={[styles.rowLabel, { textTransform: 'capitalize' }]}>{type}</Text>
            <Text style={styles.rowLabel}>₦{total.toLocaleString()}</Text>
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
      <ScrollView contentContainerStyle={styles.content}>
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
      <ScrollView contentContainerStyle={styles.content}>
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
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    rowIconGlyph: { color: colors.ink, fontSize: 15 },
    rowLabel: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    chevron: { color: colors.muted, fontSize: 18 },
    version: { color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
    field: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm },
    flabel: { color: colors.muted, fontSize: 10, letterSpacing: 0.5 },
    input: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: spacing.xs, padding: 0 },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
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
