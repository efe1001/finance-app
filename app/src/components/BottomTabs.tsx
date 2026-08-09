import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';
import { spacing, radius, ThemeColors } from '../theme';
import { useAuth } from '../auth/AuthContext';
import type { ScreenKey } from './Drawer';

const STROKE = 1.9;

// Rendered directly here (not via IconBadge) since the floating pill needs an
// icon with NO background circle when inactive and a solid violet one only
// when active - IconBadge always draws its own background, which doesn't fit.
const TAB_ICONS: Record<string, (color: string) => React.ReactNode> = {
  home: (c) => <Path d="M3 11l9-8 9 8M5 10v10h14V10" stroke={c} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  wallet: (c) => (
    <>
      <Rect x={3} y={7} width={18} height={13} rx={2} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M3 10h18M15 14h3" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  p2p: (c) => (
    <>
      <Circle cx={8} cy={9} r={3} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={16} cy={9} r={2.6} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6M16 15c3 .3 5 2.3 5 6" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
};

const TABS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'wallet', label: 'Wallet', icon: 'wallet' },
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
    <View style={styles.floatWrap} pointerEvents="box-none">
      <View style={styles.bar}>
        {TABS.map(tab => {
          const active = current === tab.key;
          const iconColor = active ? colors.signalInk : colors.muted;
          return (
            <TouchableOpacity key={tab.key} style={styles.tab} onPress={() => onNavigate(tab.key)} hitSlop={8}>
              <View style={[styles.iconCircle, active && { backgroundColor: colors.signal }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24">
                  {TAB_ICONS[tab.icon](iconColor)}
                </Svg>
              </View>
              <Text style={[styles.label, active && { color: colors.ink }]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.tab} onPress={() => onNavigate('settings')} hitSlop={8}>
          <View style={[styles.iconCircle, meActive && { backgroundColor: colors.signal }]}>
            <Text style={[styles.meText, { color: meActive ? colors.signalInk : colors.muted }]}>
              {user?.name.charAt(0).toUpperCase() ?? '☺'}
            </Text>
          </View>
          <Text style={[styles.label, meActive && { color: colors.ink }]}>Me</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    floatWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingBottom: spacing.lg },
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xs,
      gap: spacing.xs,
      shadowColor: '#000',
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    tab: { alignItems: 'center', gap: 3, width: 62, paddingVertical: 2 },
    iconCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 9, color: colors.muted, fontWeight: '600' },
    meText: { fontSize: 13, fontWeight: '700' },
  });
}
