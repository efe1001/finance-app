import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { badgeColors, darkGlyphIcons } from '../theme';
import { useTheme } from '../theme/ThemeContext';

// Kept exactly as-is: real ticker symbols and real brand colors, not part of
// the old inconsistent icon language the line-icon set below replaces.
// Replacing these would make the app less recognizable, not more premium.
const GLYPHS: Record<string, string> = {
  bitcoin: '₿',
  ethereum: 'Ξ',
  tether: '₮',
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

// One consistent stroke-icon language replacing the old mix of emoji, unicode
// symbols, and text abbreviations - every icon here renders on a neutral
// surface in the theme's single signal color, differentiated by shape alone
// rather than a different bright color per category.
const STROKE = 1.8;
function line(d: string, key?: string) {
  return (color: string) => (
    <Path d={d} stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
  );
}

const LINE_ICONS: Record<string, (color: string) => React.ReactNode> = {
  fund: line('M12 5v14M5 12h14'),
  deposit: line('M12 5v14M5 12h14'),
  send: line('M22 2L11 13M22 2l-7 20-4-9-9-4z'),
  trade: line('M4 8h16M4 8l4-4M4 8l4 4M20 16H4M20 16l-4-4M20 16l-4 4'),
  crypto: line('M4 8h16M4 8l4-4M4 8l4 4M20 16H4M20 16l-4-4M20 16l-4 4'),
  withdraw: line('M4 21h16M6 21V10M12 21V6M18 21v-8M4 10l8-6 8 6'),
  withdrawal: line('M4 21h16M6 21V10M12 21V6M18 21v-8M4 10l8-6 8 6'),
  swap: line('M17 3l4 4-4 4M21 7H9M7 13l-4 4 4 4M3 17h12'),
  admin_adjustment: line('M17 3l4 4-4 4M21 7H9M7 13l-4 4 4 4M3 17h12'),
  airtime: line('M4 5c0 8 7 15 15 15l3-4-6-3-2 2c-2-1.5-3.5-3-5-5l2-2-3-6z'),
  electricity: line('M13 2L4 14h6l-1 8 9-12h-6l1-8z'),
  education: line('M2 8l10-5 10 5-10 5-10-5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 8v7'),
  home: line('M3 11l9-8 9 8M5 10v10h14V10'),
  stats: line('M4 20V10M11 20V4M18 20v-7'),
  alerts: line('M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0'),
  approvals: line('M4 12l5 5L20 6'),

  transfer: (c) => (
    <>
      <Circle cx={8} cy={8} r={3} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M14 21c0-3-3-5-6-5s-6 2-6 5M17 8h5m-2-2 2 2-2 2" stroke={c} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  p2p: (c) => (
    <>
      <Circle cx={8} cy={9} r={3} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={16} cy={9} r={2.6} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6M16 15c3 .3 5 2.3 5 6" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  users: (c) => (
    <>
      <Circle cx={9} cy={8} r={3} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={17} cy={9} r={2.6} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6M16 15c3 .3 5 2.3 5 6" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  profile: (c) => (
    <>
      <Circle cx={12} cy={8} r={4} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  vault: (c) => (
    <>
      <Rect x={3} y={4} width={18} height={17} rx={2} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={12} cy={12.5} r={4} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M12 10.5v2l1.4 1.4" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  bills: (c) => (
    <>
      <Rect x={5} y={3} width={14} height={18} rx={2} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M8 8h8M8 12h8M8 16h5" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  data: (c) => (
    <>
      <Path d="M2 9a16 16 0 0120 0M6 13a10 10 0 0112 0M10 17a4 4 0 014 0" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      <Circle cx={12} cy={20} r={1} fill={c} />
    </>
  ),
  internet: (c) => (
    <>
      <Path d="M2 9a16 16 0 0120 0M6 13a10 10 0 0112 0M10 17a4 4 0 014 0" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      <Circle cx={12} cy={20} r={1} fill={c} />
    </>
  ),
  cableTv: (c) => (
    <>
      <Rect x={3} y={6} width={18} height={13} rx={2} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M8 3l4 3 4-3M9 22h6" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  giftcard: (c) => (
    <>
      <Rect x={3} y={8} width={18} height={13} rx={2} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path d="M12 8v13M3 8h18M12 8c-1.5-4-7-4-7 0h7zM12 8c1.5-4 7-4 7 0h-7z" stroke={c} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </>
  ),
  insurance: (c) => (
    <>
      <Path d="M3 12a9 9 0 0118 0H3z" stroke={c} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d="M12 12v7a2 2 0 01-4 0" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
    </>
  ),
  betting: (c) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={12} cy={12} r={4.5} stroke={c} strokeWidth={STROKE} fill="none" />
      <Circle cx={12} cy={12} r={1.2} fill={c} />
    </>
  ),
  limits: (c) => (
    <>
      <Circle cx={12} cy={12} r={3} stroke={c} strokeWidth={STROKE} fill="none" />
      <Path
        d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"
        stroke={c}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  support: (c) => (
    <>
      <Path d="M4 17v-5a8 8 0 0116 0v5" stroke={c} strokeWidth={STROKE} strokeLinecap="round" fill="none" />
      <Rect x={3} y={12} width={4} height={6} rx={1} stroke={c} strokeWidth={STROKE} fill="none" />
      <Rect x={17} y={12} width={4} height={6} rx={1} stroke={c} strokeWidth={STROKE} fill="none" />
    </>
  ),
};

export default function IconBadge({
  name,
  size = 44,
  glyphSize,
}: {
  name: string;
  size?: number;
  glyphSize?: number;
}) {
  const { colors } = useTheme();
  const lineIcon = LINE_ICONS[name];

  if (lineIcon) {
    const iconSize = (glyphSize ?? size * 0.42) * 1.15;
    return (
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface2 },
        ]}>
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24">
          {lineIcon(colors.signal)}
        </Svg>
      </View>
    );
  }

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
