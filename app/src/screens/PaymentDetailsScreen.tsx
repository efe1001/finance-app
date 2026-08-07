import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, FlatList, ActivityIndicator } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

type Bank = { code: string; name: string };

export default function PaymentDetailsScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user, refreshUser } = useAuth();
  const styles = getStyles(colors);
  const [editing, setEditing] = useState(!user?.payoutAccountNumber);
  const [accountNumber, setAccountNumber] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [statusOk, setStatusOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.flutterwave.banks().then(setBanks).catch(() => {});
  }, []);

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
    if (accountNumber.length === 10 && bank) {
      resolveAccount(accountNumber, bank);
    } else {
      setResolvedName(null);
      setResolveError(null);
    }
  }, [accountNumber, bank, resolveAccount]);

  const filteredBanks = useMemo(
    () => banks.filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase())),
    [banks, bankSearch],
  );

  const canSave = !!bank && accountNumber.length === 10 && !!resolvedName && !resolving;

  async function save() {
    if (!canSave || !bank || !resolvedName) return;
    setSaving(true);
    setStatus(null);
    try {
      await api.savePayoutAccount({ bankCode: bank.code, bankName: bank.name, accountNumber, accountName: resolvedName });
      await refreshUser();
      setStatus('Payment details saved.');
      setStatusOk(true);
      setEditing(false);
      setAccountNumber('');
      setBank(null);
      setResolvedName(null);
    } catch (e: any) {
      setStatus(e.message);
      setStatusOk(false);
    } finally {
      setSaving(false);
    }
  }

  if (!editing && user?.payoutAccountNumber) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Payment Details" onBack={onBack} colors={colors} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <Text style={styles.hint}>
            This is the bank account gift card sales and other payouts are sent to.
          </Text>
          <View style={styles.savedCard}>
            <View style={styles.savedIcon}>
              <Text style={styles.savedIconText}>🏦</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.savedName}>{user.payoutAccountName}</Text>
              <Text style={styles.savedBank}>{user.payoutBankName}</Text>
              <Text style={styles.savedNumber}>{user.payoutAccountNumber}</Text>
            </View>
          </View>
          {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}
          <TouchableOpacity style={styles.cta} onPress={() => setEditing(true)}>
            <Text style={styles.ctaText}>Change Account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Payment Details" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Add the bank account you want to be paid into — this is used for gift card sales and can speed up withdrawals too.
        </Text>

        <TouchableOpacity style={styles.fieldSimple} onPress={() => setBankModalVisible(true)}>
          <Text style={bank ? styles.pickerValue : styles.pickerPlaceholder}>{bank ? bank.name : 'Select Bank'}</Text>
        </TouchableOpacity>

        <View style={styles.fieldSimple}>
          <TextInput
            style={styles.input}
            value={accountNumber}
            onChangeText={t => setAccountNumber(t.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="Account Number"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        {resolving && (
          <View style={styles.resolveRow}>
            <ActivityIndicator size="small" color={colors.signal} />
            <Text style={styles.resolveText}>Verifying account…</Text>
          </View>
        )}
        {resolvedName && (
          <View style={styles.resolveRow}>
            <Text style={styles.resolvedName}>✓ {resolvedName}</Text>
          </View>
        )}
        {resolveError && !resolving && (
          <View style={styles.resolveRow}>
            <Text style={styles.resolveErrorText}>{resolveError}</Text>
          </View>
        )}

        {status && <Text style={[styles.status, statusOk ? styles.statusOk : styles.statusError]}>{status}</Text>}

        {user?.payoutAccountNumber && (
          <TouchableOpacity style={styles.cancelLink} onPress={() => { setEditing(false); setStatus(null); }}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.cta, (!canSave || saving) && { opacity: 0.5 }]} onPress={save} disabled={!canSave || saving}>
          <Text style={styles.ctaText}>{saving ? 'Saving…' : 'Save Payment Details'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={bankModalVisible} animationType="slide" onRequestClose={() => setBankModalVisible(false)}>
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalHeaderTitle}>Select Bank</Text>
            <TouchableOpacity onPress={() => setBankModalVisible(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchWrap}>
            <TextInput
              style={styles.modalSearch}
              value={bankSearch}
              onChangeText={setBankSearch}
              placeholder="Search banks…"
              placeholderTextColor={colors.muted}
            />
          </View>
          {banks.length === 0 ? (
            <Text style={styles.empty}>Loading banks…</Text>
          ) : (
            <FlatList
              data={filteredBanks}
              keyExtractor={b => b.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankRow}
                  onPress={() => {
                    setBank(item);
                    setBankModalVisible(false);
                    setBankSearch('');
                  }}>
                  <Text style={styles.bankRowText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { padding: spacing.lg, paddingBottom: spacing.xxl },
    hint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: spacing.lg },
    savedCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
    savedIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
    savedIconText: { fontSize: 20 },
    savedName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    savedBank: { color: colors.muted, fontSize: 12.5, marginTop: 2 },
    savedNumber: { color: colors.muted, fontSize: 12.5, marginTop: 1 },
    fieldSimple: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, justifyContent: 'center', minHeight: 52 },
    input: { color: colors.ink, fontSize: 15, paddingVertical: spacing.lg },
    pickerValue: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    pickerPlaceholder: { color: colors.muted, fontSize: 15 },
    resolveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
    resolveText: { color: colors.muted, fontSize: 12 },
    resolvedName: { color: colors.jade, fontSize: 13, fontWeight: '700' },
    resolveErrorText: { color: colors.ember, fontSize: 12 },
    status: { fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    statusOk: { color: colors.jade },
    statusError: { color: colors.ember },
    cancelLink: { alignItems: 'center', paddingVertical: spacing.md },
    cancelLinkText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
    empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.xl },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
    modalScreen: { flex: 1, backgroundColor: colors.bg },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, paddingTop: spacing.xxl, borderBottomWidth: 1, borderBottomColor: colors.line },
    modalHeaderTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    modalClose: { color: colors.muted, fontSize: 18 },
    modalSearchWrap: { padding: spacing.lg },
    modalSearch: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.ink, fontSize: 14 },
    bankRow: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
    bankRowText: { color: colors.ink, fontSize: 14 },
  });
}
