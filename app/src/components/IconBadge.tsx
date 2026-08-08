import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { badgeColors, darkGlyphIcons } from '../theme';

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
  transfer: '↦',
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
  'usd-coin': '$',
  binancecoin: 'B',
  solana: '◎',
  ripple: 'X',
  dogecoin: 'Ð',
  mtn: 'MTN',
  airtel: 'AIR',
  glo: 'GLO',
  '9mobile': '9M',
  dstv: 'DSTV',
  gotv: 'GOTV',
  startimes: 'STAR',
  smile: 'SML',
  spectranet: 'SPEC',
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
  const dark = darkGlyphIcons.has(name);
  // Longer brand abbreviations (DSTV, GOTV, STAR...) need a smaller font to
  // fit the same circle a single glyph character sits comfortably in.
  const baseSize = glyphSize ?? size * 0.42;
  const fontSize = glyph.length > 2 ? baseSize * (2.4 / glyph.length) : baseSize;
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}>
      <Text
        style={[styles.glyph, { fontSize, color: dark ? '#17110A' : '#FFFFFF' }]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  glyph: { fontWeight: '700' },
});
