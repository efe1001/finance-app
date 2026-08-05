import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, FlatList, ActivityIndicator } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import ScreenHeader from '../components/ScreenHeader';

type Bank = { code: string; name: string };

export default function WithdrawScreen({ onBack, colors }: { onBack: () => void; colors: ThemeColors }) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const [limits, setLimits] = useState<{ min_withdrawal_ngn: number; max_withdrawal_ngn: number } | null>(null);
  const [amount, setAmount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bank, setBank] = useState<Bank | null>(null);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [narration, setNarration] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.limits().then(setLimits as any).catch(() => {});
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

  const canSubmit = !!amount && !!bank && accountNumber.length === 10 && !!resolvedName && !resolving;

  async function submit() {
    if (!canSubmit || !bank) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await api.withdraw({
        amountNgn: Number(amount),
        accountNumber,
        bankName: bank.name,
        bankCode: bank.code,
        accountName: resolvedName || undefined,
        narration: narration || undefined,
      });
      setStatus(res.message);
      setAmount('');
      setAccountNumber('');
      setBank(null);
      setResolvedName(null);
      setNarration('');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Withdraw Naira" onBack={onBack} colors={colors} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceIcon}>
            <Text style={styles.balanceIconText}>₦</Text>
          </View>
          <View>
            <Text style={styles.balanceAmount}>
              ₦{(user?.walletBalanceNgn ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </Text>
            <Text style={styles.balanceLabel}>NGN Balance</Text>
          </View>
        </View>

        {limits && (
          <Text style={styles.limitsNote}>
            Withdrawal limits: ₦{limits.min_withdrawal_ngn.toLocaleString()} – ₦{limits.max_withdrawal_ngn.toLocaleString()}
          </Text>
        )}

        <View style={styles.field}>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter Amount"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity style={styles.maxBtn} onPress={() => setAmount(String(user?.walletBalanceNgn ?? 0))}>
            <Text style={styles.maxBtnText}>Max</Text>
          </TouchableOpacity>
        </View>

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

        <View style={styles.fieldSimple}>
          <TextInput
            style={styles.input}
            value={narration}
            onChangeText={setNarration}
            placeholder="Add Narration (optional)"
            placeholderTextColor={colors.muted}
          />
        </View>

        {status && <Text style={styles.status}>{status}</Text>}

        <Text style={styles.savedHead}>SAVED BENEFICIARIES</Text>
        <Text style={styles.empty}>No saved beneficiaries</Text>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.cta, (!canSubmit || loading) && { opacity: 0.5 }]} onPress={submit} disabled={!canSubmit || loading}>
          <Text style={styles.ctaText}>{loading ? 'Submitting…' : 'Withdraw'}</Text>
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
    balanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
    balanceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, borderWidth: 2, borderColor: colors.jade, alignItems: 'center', justifyContent: 'center' },
    balanceIconText: { color: colors.jade, fontWeight: '700', fontSize: 16 },
    balanceAmount: { color: colors.ink, fontSize: 22, fontWeight: '700' },
    balanceLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
    limitsNote: { color: colors.muted, fontSize: 11, marginBottom: spacing.lg },
    field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    amountInput: { flex: 1, color: colors.ink, fontSize: 16, paddingVertical: spacing.lg },
    maxBtn: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    maxBtnText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
    fieldSimple: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, justifyContent: 'center', minHeight: 52 },
    input: { color: colors.ink, fontSize: 15, paddingVertical: spacing.lg },
    pickerValue: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    pickerPlaceholder: { color: colors.muted, fontSize: 15 },
    resolveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.xs },
    resolveText: { color: colors.muted, fontSize: 12 },
    resolvedName: { color: colors.jade, fontSize: 13, fontWeight: '700' },
    resolveErrorText: { color: colors.ember, fontSize: 12 },
    status: { color: colors.jade, fontSize: 12, marginTop: spacing.sm, marginBottom: spacing.sm },
    savedHead: { color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm },
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
