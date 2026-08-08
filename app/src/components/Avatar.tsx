import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { ThemeColors } from '../theme';
import { avatarPresetById } from '../avatarPresets';
import { avatarUrl } from '../api/client';

export type AvatarUser = {
  id: number;
  name: string;
  avatarKind?: string | null;
  avatarValue?: string | null;
  avatarUpdatedAt?: string | null;
};

export default function Avatar({ user, size = 48, colors }: { user: AvatarUser | null | undefined; size: number; colors: ThemeColors }) {
  const circle = { width: size, height: size, borderRadius: size / 2 };

  if (user?.avatarKind === 'upload') {
    // Cache-busted so re-uploading a new photo doesn't keep showing the old
    // one from RN's image cache.
    const uri = `${avatarUrl(user.id)}?v=${user.avatarUpdatedAt ?? ''}`;
    return <Image source={{ uri }} style={[styles.circle, circle, { backgroundColor: colors.surface2 }]} />;
  }

  if (user?.avatarKind === 'preset') {
    const preset = avatarPresetById(user.avatarValue);
    return (
      <View style={[styles.circle, circle, { backgroundColor: preset.bg }]}>
        <Text style={{ fontSize: size * 0.52 }}>{preset.emoji}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.circle, circle, { backgroundColor: colors.signal }]}>
      <Text style={{ color: colors.signalInk, fontWeight: '700', fontSize: size * 0.4 }}>
        {(user?.name ?? '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
