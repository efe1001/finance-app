import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import type { ScreenKey } from './Drawer';
import IconBadge from './IconBadge';

const TABS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'wallet', label: 'Wallet', icon: 'trade' },
  { key: 'p2p', label: 'P2P', icon: 'p2p' },
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
          <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onNavigate(tab.key)} hitSlop={8}>
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <IconBadge name={tab.icon} size={30} glyphSize={15} />
            </View>
            <Text style={[styles.label, active && { color: colors.ink }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity style={styles.tab} onPress={() => onNavigate('settings')} hitSlop={8}>
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
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
      alignItems: 'flex-start',
    },
    tab: { flex: 1, alignItems: 'center', gap: 5 },
    iconWrap: { borderRadius: 19, padding: 2, opacity: 0.55 },
    iconWrapActive: { opacity: 1 },
    label: { fontSize: 10.5, color: colors.muted, fontWeight: '600' },
    meAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.55,
    },
    meAvatarActive: {
      backgroundColor: colors.signal,
      opacity: 1,
      shadowColor: colors.signal,
      shadowOpacity: 0.6,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    meAvatarText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  });
}
