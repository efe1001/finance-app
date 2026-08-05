import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, radius, ThemeColors } from '../theme';
import IconBadge from './IconBadge';

export default function ScreenHeader({
  title,
  onBack,
  colors,
  right,
}: {
  title: string;
  onBack: () => void;
  colors: ThemeColors;
  right?: React.ReactNode;
}) {
  const styles = getStyles(colors);
  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={10}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backArrow: { color: colors.ink, fontSize: 18, fontWeight: '700' },
    title: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '700', marginLeft: spacing.md },
    right: { minWidth: 36, alignItems: 'flex-end' },
  });
}
