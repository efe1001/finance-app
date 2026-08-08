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
  Modal,
} from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { useCurrency, COUNTRIES } from '../currency/CurrencyContext';

export default function RegisterScreen({ onGoToLogin }: { onGoToLogin: () => void }) {
  const { register, loading, error } = useAuth();
  const { colors } = useTheme();
  const { setCurrency } = useCurrency();
  const styles = getStyles(colors);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [country, setCountry] = useState<typeof COUNTRIES[number] | null>(null);
  const [countryModalOpen, setCountryModalOpen] = useState(false);

  const mismatch = password.length > 0 && confirmPassword.length > 0 && password !== confirmPassword;
  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(username);
  const canSubmit = !!name && !!email && !!phone && usernameValid && password.length >= 6 && password === confirmPassword;

  async function submit() {
    if (!canSubmit) return;
    await register(name, email, password, phone, username, referralCode, country?.name);
    if (country) setCurrency(country.currency);
  }

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
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={t => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ''))}
            placeholder="e.g. efe_dev"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            maxLength={20}
          />
          {!!username && !usernameValid && (
            <Text style={styles.mismatch}>3-20 characters, letters, numbers and underscores only.</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PHONE NUMBER</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={t => setPhone(t.replace(/[^0-9+]/g, ''))}
            placeholder="e.g. 08012345678"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={colors.muted}
              secureTextEntry={!reveal}
            />
            <TouchableOpacity style={styles.revealBtn} onPress={() => setReveal(r => !r)} hitSlop={8}>
              <Text style={styles.revealBtnText}>{reveal ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            placeholderTextColor={colors.muted}
            secureTextEntry={!reveal}
          />
          {mismatch && <Text style={styles.mismatch}>Passwords don't match.</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>COUNTRY</Text>
          <TouchableOpacity style={styles.input} onPress={() => setCountryModalOpen(true)}>
            <Text style={country ? styles.pickerValue : styles.pickerPlaceholder}>
              {country ? `${country.name} (${country.currency})` : 'Select your country'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.hint}>Sets your default display currency — change it anytime in Settings.</Text>
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

        <TouchableOpacity style={[styles.cta, (loading || !canSubmit) && { opacity: 0.6 }]} disabled={loading || !canSubmit} onPress={submit}>
          <Text style={styles.ctaText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={onGoToLogin}>
          <Text style={styles.linkText}>
            Already have an account? <Text style={styles.linkStrong}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={countryModalOpen} transparent animationType="fade" onRequestClose={() => setCountryModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country</Text>
            {COUNTRIES.map(c => (
              <TouchableOpacity
                key={c.name}
                style={styles.countryRow}
                onPress={() => {
                  setCountry(c);
                  setCountryModalOpen(false);
                }}>
                <Text style={styles.countryRowText}>{c.name}</Text>
                <Text style={styles.countryRowCurrency}>{c.currency}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
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
    input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, color: colors.ink, fontSize: 15, justifyContent: 'center' },
    passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingRight: spacing.md },
    passwordInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
    revealBtn: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    revealBtnText: { color: colors.signal, fontSize: 12, fontWeight: '700' },
    mismatch: { color: colors.ember, fontSize: 11.5, marginTop: spacing.xs },
    pickerValue: { color: colors.ink, fontSize: 15 },
    pickerPlaceholder: { color: colors.muted, fontSize: 15 },
    hint: { color: colors.muted, fontSize: 10.5, marginTop: spacing.xs },
    error: { color: colors.ember, fontSize: 13, marginBottom: spacing.lg },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    linkRow: { marginTop: spacing.xl, alignItems: 'center' },
    linkText: { color: colors.muted, fontSize: 13 },
    linkStrong: { color: colors.signal, fontWeight: '700' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line },
    modalTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
    countryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
    countryRowText: { color: colors.ink, fontSize: 14 },
    countryRowCurrency: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  });
}
