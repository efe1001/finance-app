import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import { useAppLock } from '../security/AppLockContext';

export default function LockScreen({ colors }: { colors: ThemeColors }) {
  const { unlock } = useAppLock();
  const styles = getStyles(colors);

  useEffect(() => {
    unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.screen}>
      <Text style={styles.glyph}>🔒</Text>
      <Text style={styles.title}>Finance App is locked</Text>
      <Text style={styles.subtitle}>Authenticate to continue</Text>
      <TouchableOpacity style={styles.cta} onPress={unlock}>
        <Text style={styles.ctaText}>Unlock</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
    glyph: { fontSize: 48, marginBottom: spacing.lg },
    title: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: spacing.xs },
    subtitle: { color: colors.muted, fontSize: 13, marginBottom: spacing.xxl },
    cta: { backgroundColor: colors.signal, borderRadius: radius.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.xxl },
    ctaText: { color: colors.signalInk, fontWeight: '700', fontSize: 15 },
  });
}
