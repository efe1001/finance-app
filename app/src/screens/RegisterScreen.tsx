import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';

export default function RegisterScreen({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { register, loading, error } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Finance App</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start trading, paying bills, and more</Text>

        <View style={styles.field}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Efe Efe" placeholderTextColor={colors.muted} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@email.com"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.muted}
            secureTextEntry
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>REFERRAL CODE (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            value={referralCode}
            onChangeText={setReferralCode}
            placeholder="e.g. FA000123"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={() => register(name, email, password, referralCode)}>
          <Text style={styles.ctaText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onGoToLogin}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkStrong}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xxl },
    brand: { color: colors.signal, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: spacing.xxl },
    title: { color: colors.ink, fontSize: 26, fontWeight: '700', marginBottom: spacing.xs },
    subtitle: { color: colors.muted, fontSize: 14, marginBottom: spacing.xxl },
    field: { marginBottom: spacing.lg },
    label: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, color: colors.ink, fontSize: 15 },
    error: { color: colors.ember, fontSize: 13, marginBottom: spacing.lg },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    linkRow: { marginTop: spacing.xl, alignItems: 'center' },
    linkText: { color: colors.muted, fontSize: 13 },
    linkStrong: { color: colors.signal, fontWeight: '700' },
  });
}
