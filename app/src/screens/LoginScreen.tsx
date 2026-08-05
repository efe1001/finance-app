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

export default function LoginScreen({ onGoToRegister }: { onGoToRegister: () => void }) {
  const { login, loading, error } = useAuth();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
          />
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={() => login(email, password)}>
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
    error: { color: colors.ember, fontSize: 13, marginBottom: spacing.lg },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    linkRow: { marginTop: spacing.xl, alignItems: 'center' },
    linkText: { color: colors.muted, fontSize: 13 },
    linkStrong: { color: colors.signal, fontWeight: '700' },
  });
}
