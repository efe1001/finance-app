import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import ScreenHeader from '../components/ScreenHeader';

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

function comingSoon(feature: string) {
  Alert.alert(feature, `${feature} is coming soon.`);
}

export default function SettingsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
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
          <Row icon="☺" label="My Profile" colors={colors} onPress={() => comingSoon('My Profile')} />
          <Row icon="▤" label="Reports" colors={colors} onPress={() => comingSoon('Reports')} />
          <Row icon="↗" label="Referrals" colors={colors} onPress={() => comingSoon('Referrals')} />
          <Row icon="◐" label="Help & Support" colors={colors} onPress={() => comingSoon('Help & Support')} />
          <Row icon="▮▯" label="Expenses" colors={colors} onPress={() => comingSoon('Expenses')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="⌂" label="Leaderboard" colors={colors} onPress={() => comingSoon('Leaderboard')} />
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
          <Row icon="⚿" label="Reset Password" colors={colors} onPress={() => comingSoon('Reset Password')} />
          <Row icon="◐" label="Reset Transaction PIN" colors={colors} onPress={() => comingSoon('Reset Transaction PIN')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="◐" label="Verify NIN" colors={colors} onPress={() => comingSoon('NIN verification')} />
          </View>
        </View>

        <Text style={styles.sectionHead}>MORE</Text>
        <View style={styles.card}>
          <Row icon="▤" label="Legal" colors={colors} onPress={() => comingSoon('Legal')} />
          <Row icon="⊗" label="Deactivate / Delete Account" colors={colors} onPress={() => comingSoon('Account deletion')} />
          <View style={{ borderBottomWidth: 0 }}>
            <Row icon="⎋" label="Logout" colors={colors} onPress={logout} danger />
          </View>
        </View>

        <Text style={styles.version}>Version 1.0.0 (debug)</Text>
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
  });
}
