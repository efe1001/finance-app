import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking, ScrollView } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import type { UpdateInfo } from '../updateCheck';

export default function UpdateModal({
  update,
  onDismiss,
  colors,
}: {
  update: UpdateInfo | null;
  onDismiss: () => void;
  colors: ThemeColors;
}) {
  const styles = getStyles(colors);
  if (!update) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.glyph}>⬆️</Text>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.subtitle}>Version {update.version} is ready to download</Text>
          {!!update.notes && (
            <ScrollView style={styles.notesBox}>
              <Text style={styles.notes}>{update.notes}</Text>
            </ScrollView>
          )}
          <TouchableOpacity style={styles.cta} onPress={() => Linking.openURL(update.url)}>
            <Text style={styles.ctaText}>Download Update</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={onDismiss}>
            <Text style={styles.laterText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: spacing.xl },
    card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
    glyph: { fontSize: 36, marginBottom: spacing.sm },
    title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
    subtitle: { color: colors.muted, fontSize: 12.5, marginTop: spacing.xs, marginBottom: spacing.md, textAlign: 'center' },
    notesBox: { maxHeight: 120, alignSelf: 'stretch', backgroundColor: colors.surface2, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg },
    notes: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, alignSelf: 'stretch', alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    later: { marginTop: spacing.md },
    laterText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  });
}
