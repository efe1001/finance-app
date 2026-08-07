import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Share } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';

export type ReceiptRow = { label: string; value: string };

export type Receipt = {
  heading: string;
  status: string;
  rows: ReceiptRow[];
  footerNote?: string;
};

export default function ReceiptModal({
  receipt,
  onClose,
  colors,
}: {
  receipt: Receipt | null;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const styles = getStyles(colors);
  if (!receipt) return null;

  function share() {
    if (!receipt) return;
    const lines = [
      'FINANCE APP · RECEIPT',
      receipt.heading,
      `Status: ${receipt.status}`,
      '',
      ...receipt.rows.map(r => `${r.label}: ${r.value}`),
    ];
    if (receipt.footerNote) lines.push('', receipt.footerNote);
    Share.share({ message: lines.join('\n') });
  }

  return (
    <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>FINANCE APP</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heading}>{receipt.heading}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{receipt.status}</Text>
          </View>

          <ScrollView style={styles.rowsScroll}>
            {receipt.rows.map((r, idx) => (
              <View key={idx} style={styles.row}>
                <Text style={styles.rowLabel}>{r.label}</Text>
                <Text style={styles.rowValue} numberOfLines={2} selectable>{r.value}</Text>
              </View>
            ))}
          </ScrollView>

          {receipt.footerNote && <Text style={styles.footerNote}>{receipt.footerNote}</Text>}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.shareBtn} onPress={share}>
              <Text style={styles.shareBtnText}>Share Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.xl },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, maxHeight: '80%' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    brand: { color: colors.signal, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
    close: { color: colors.muted, fontSize: 18 },
    heading: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: spacing.md },
    statusPill: { alignSelf: 'flex-start', backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4, marginTop: spacing.sm, marginBottom: spacing.lg },
    statusPillText: { color: colors.signal, fontSize: 11, fontWeight: '700' },
    rowsScroll: { borderTopWidth: 1, borderTopColor: colors.line, borderStyle: 'dashed' as const, paddingTop: spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowLabel: { color: colors.muted, fontSize: 12, flexShrink: 0 },
    rowValue: { color: colors.ink, fontSize: 12.5, fontWeight: '600', flex: 1, textAlign: 'right' },
    footerNote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.md },
    actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
    shareBtn: { flex: 1, backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    shareBtnText: { color: colors.signalInk, fontWeight: '700', fontSize: 13.5 },
    closeBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
    closeBtnText: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  });
}
