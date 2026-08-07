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
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [country, setCountry] = useState<typeof COUNTRIES[number] | null>(null);
  const [countryModalOpen, setCountryModalOpen] = useState(false);

  async function submit() {
    await register(name, email, password, referralCode, country?.name);
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

        <TouchableOpacity style={[styles.cta, loading && { opacity: 0.6 }]} disabled={loading} onPress={submit}>
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
