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
  Alert,
} from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency, COUNTRIES } from '../currency/CurrencyContext';

export default function LoginScreen({ onGoToRegister }: { onGoToRegister: () => void }) {
  const { login, loading, error } = useAuth();
  const { colors } = useTheme();
  const { setCurrency } = useCurrency();
  const styles = getStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);

  async function submit() {
    const user = await login(email, password);
    const match = COUNTRIES.find(c => c.name === user.country);
    if (match) setCurrency(match.currency);
  }

  function forgotPassword() {
    Alert.alert(
      'Forgot your password?',
      'Email support@financeapp.com from your registered email address and an admin will help you reset it.',
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>Finance App</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Log in to your wallet</Text>

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
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry={!reveal}
            />
            <TouchableOpacity style={styles.revealBtn} onPress={() => setReveal(r => !r)} hitSlop={8}>
              <Text style={styles.revealBtnText}>{reveal ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={forgotPassword} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={submit}>
          <Text style={styles.ctaText}>{loading ? 'Logging in…' : 'Log In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onGoToRegister}>
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkStrong}>Create one</Text>
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
    title: { color: colors.ink, fontSize: 28, fontWeight: '700', marginBottom: spacing.xs },
    subtitle: { color: colors.muted, fontSize: 14, marginBottom: spacing.xxl },
    field: { marginBottom: spacing.lg },
    label: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: spacing.sm },
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, color: colors.ink, fontSize: 15 },
    passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingRight: spacing.md },
    passwordInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
    revealBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    revealBtnText: { color: colors.signal, fontSize: 12, fontWeight: '700' },
    forgotRow: { alignItems: 'flex-end', marginTop: -spacing.sm, marginBottom: spacing.lg },
    forgotText: { color: colors.signal, fontSize: 12.5, fontWeight: '600' },
    error: { color: colors.ember, fontSize: 13, marginBottom: spacing.lg },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    linkRow: { marginTop: spacing.xl, alignItems: 'center' },
    linkText: { color: colors.muted, fontSize: 13 },
    linkStrong: { color: colors.signal, fontWeight: '700' },
  });
}
