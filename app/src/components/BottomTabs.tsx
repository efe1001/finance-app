import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import type { ScreenKey } from './Drawer';

const TABS: { key: ScreenKey; label: string; glyph: string }[] = [
  { key: 'home', label: 'Home', glyph: '⌂' },
  { key: 'wallet', label: 'Wallet', glyph: '◈' },
  { key: 'p2p', label: 'P2P', glyph: '⇄' },
];

export default function BottomTabs({
  current,
  onNavigate,
  colors,
}: {
  current: ScreenKey;
  onNavigate: (key: ScreenKey) => void;
  colors: ThemeColors;
}) {
  const { user } = useAuth();
  const styles = getStyles(colors);
  const meActive = current === 'settings';

  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const active = current === tab.key;
        return (
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onNavigate(tab.key)}>
            <Text style={[styles.glyph, active && { color: colors.signal }]}>{tab.glyph}</Text>
            <Text style={[styles.label, active && { color: colors.ink }]}>{tab.label}</Text>
            {active && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('settings')}>
        <View style={[styles.meAvatar, meActive && styles.meAvatarActive]}>
          <Text style={styles.meAvatarText}>{user?.name.charAt(0).toUpperCase() ?? '☺'}</Text>
        </View>
        <Text style={[styles.label, meActive && { color: colors.ink }]}>Me</Text>
      </TouchableOpacity>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      alignItems: 'flex-start',
    },
    tab: { flex: 1, alignItems: 'center', gap: 3 },
    glyph: { fontSize: 20, color: colors.muted },
    label: { fontSize: 10, color: colors.muted, fontWeight: '600' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.signal, marginTop: 2 },
    meAvatar: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 1,
    },
    meAvatarActive: {
      backgroundColor: colors.signal,
      shadowColor: colors.signal,
      shadowOpacity: 0.6,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    meAvatarText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  });
}
