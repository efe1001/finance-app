import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';

export default function NotificationPromptModal({
  visible,
  onEnable,
  onDismiss,
  colors,
}: {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
  colors: ThemeColors;
}) {
  const styles = getStyles(colors);
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.glyph}>🔔</Text>
          <Text style={styles.title}>Stay in the Loop</Text>
          <Text style={styles.subtitle}>
            Get notified the moment your deposits, withdrawals, trades, and gift card sales are approved — no need to keep checking.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={onEnable}>
            <Text style={styles.ctaText}>Enable Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.later} onPress={onDismiss}>
            <Text style={styles.laterText}>Not Now</Text>
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
    subtitle: { color: colors.muted, fontSize: 12.5, marginTop: spacing.xs, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 18 },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl, alignSelf: 'stretch', alignItems: 'center' },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 14 },
    later: { marginTop: spacing.md },
    laterText: { color: colors.muted, fontSize: 12.5, fontWeight: '600' },
  });
}
