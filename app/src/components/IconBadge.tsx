import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { badgeColors } from '../theme';

const GLYPHS: Record<string, string> = {
  fund: '+',
  send: '↗',
  trade: '⇅',
  bills: '▤',
  airtime: '☎',
  data: '▮▯',
  electricity: '⚡',
  cableTv: '▭',
  betting: '◷',
  internet: '◉',
  education: '🎓',
  insurance: '☂',
  giftcard: '🎁',
  p2p: '⇄',
  home: '⌂',
  support: '◐',
  profile: '☺',
  back: '←',
  menu: '≡',
  sun: '☀',
  moon: '☾',
  eye: '◉',
  eyeOff: '◌',
  history: '↻',
  withdraw: '↗',
  swap: '⇄',
  alerts: '◔',
  bitcoin: '₿',
  ethereum: 'Ξ',
  tether: '₮',
  approvals: '✓',
  users: '👥',
  stats: '📊',
  vault: '🏦',
  limits: '⚙',
  crypto: '⇅',
  admin_adjustment: '⇄',
  deposit: '+',
  withdrawal: '↗',
};

export default function IconBadge({
  name,
  size = 44,
  glyphSize,
}: {
  name: keyof typeof GLYPHS | string;
  size?: number;
  glyphSize?: number;
}) {
  const bg = (badgeColors as Record<string, string>)[name] ?? '#6B7280';
  const glyph = GLYPHS[name] ?? '●';
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}>
      <Text style={[styles.glyph, { fontSize: glyphSize ?? size * 0.42 }]}>{glyph}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  glyph: { color: '#FFFFFF', fontWeight: '700' },
});
