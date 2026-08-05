import React, { useEffect, useRef } from 'react';
import {
  Animated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';

const DRAWER_WIDTH = Math.min(300, Dimensions.get('window').width * 0.8);

export type ScreenKey =
  | 'home'
  | 'wallet'
  | 'trade'
  | 'p2p'
  | 'giftcards'
  | 'bills'
  | 'deposit'
  | 'withdraw'
  | 'settings'
  | 'admin';

const NAV_ITEMS: { key: ScreenKey; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'wallet', label: 'Wallet', icon: '◈' },
  { key: 'trade', label: 'Trade', icon: '⇅' },
  { key: 'p2p', label: 'P2P · Direct', icon: '⇄' },
  { key: 'giftcards', label: 'Gift Cards', icon: '🎁' },
  { key: 'bills', label: 'Bills & Recharge', icon: '▤' },
  { key: 'deposit', label: 'Add Money', icon: '+' },
  { key: 'withdraw', label: 'Withdraw', icon: '↗' },
  { key: 'settings', label: 'Settings', icon: '⚙' },
];

export default function Drawer({
  open,
  onClose,
  current,
  onNavigate,
  userName,
  userEmail,
  onLogout,
  colors,
}: {
  open: boolean;
  onClose: () => void;
  current: ScreenKey;
  onNavigate: (key: ScreenKey) => void;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  colors: ThemeColors;
}) {
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const styles = getStyles(colors);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : -DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, translateX, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{userName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{userName}</Text>
          <Text style={styles.email}>{userEmail}</Text>
        </View>

        <View style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, current === item.key && styles.navItemActive]}
              onPress={() => onNavigate(item.key)}>
              <Text style={[styles.navIcon, current === item.key && { color: colors.signal }]}>
                {item.icon}
              </Text>
              <Text style={[styles.navLabel, current === item.key && { color: colors.ink }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logout} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
    drawer: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      width: DRAWER_WIDTH,
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.line,
      paddingTop: 56,
      paddingHorizontal: spacing.lg,
    },
    header: { marginBottom: spacing.xl, paddingBottom: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.signal,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    avatarText: { color: colors.signalInk, fontWeight: '700', fontSize: 18 },
    name: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    email: { color: colors.muted, fontSize: 12, marginTop: 2 },
    nav: { flex: 1 },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      marginBottom: spacing.xs,
    },
    navItemActive: { backgroundColor: colors.surface2 },
    navIcon: { color: colors.muted, fontSize: 16, width: 22, textAlign: 'center' },
    navLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
    logout: { paddingVertical: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
    logoutText: { color: colors.ember, fontWeight: '700', fontSize: 14 },
  });
}
