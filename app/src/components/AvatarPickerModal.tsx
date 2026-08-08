import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { pick, isErrorWithCode, errorCodes, types as pickerTypes } from '@react-native-documents/picker';
import { spacing, radius, ThemeColors } from '../theme';
import { api } from '../api/client';
import { AVATAR_PRESETS } from '../avatarPresets';
import { readFileAsBase64 } from '../utils/fileToBase64';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024;

export default function AvatarPickerModal({
  visible,
  onClose,
  onSaved,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  colors: ThemeColors;
}) {
  const styles = getStyles(colors);
  const [saving, setSaving] = useState<string | null>(null);

  async function pickPreset(id: string) {
    setSaving(id);
    try {
      await api.setAvatarPreset(id);
      onSaved();
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(null);
    }
  }

  async function uploadPhoto() {
    try {
      const [res] = await pick({ type: [pickerTypes.images] });
      if ((res.size ?? 0) > MAX_AVATAR_BYTES) {
        Alert.alert('Photo too large', 'Please choose an image under 3MB.');
        return;
      }
      setSaving('upload');
      const data = await readFileAsBase64(res.uri);
      await api.uploadAvatar(data, res.type || 'image/jpeg');
      onSaved();
      onClose();
    } catch (e: any) {
      if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
        Alert.alert('Error', e.message || 'Could not upload that photo.');
      }
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Choose Avatar</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.uploadBtn} onPress={uploadPhoto} disabled={!!saving}>
            {saving === 'upload' ? (
              <ActivityIndicator color={colors.signal} />
            ) : (
              <Text style={styles.uploadBtnText}>📷 Upload from your photos</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.sectionLabel}>OR PICK ONE</Text>
          <ScrollView contentContainerStyle={styles.grid}>
            {AVATAR_PRESETS.map(p => (
              <TouchableOpacity key={p.id} style={styles.presetItem} onPress={() => pickPreset(p.id)} disabled={!!saving}>
                <View style={[styles.presetCircle, { backgroundColor: p.bg }]}>
                  {saving === p.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.presetEmoji}>{p.emoji}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    card: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, maxHeight: '75%' },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    title: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    close: { color: colors.muted, fontSize: 18 },
    uploadBtn: { backgroundColor: colors.surface2, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
    uploadBtnText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    sectionLabel: { color: colors.muted, fontSize: 10.5, letterSpacing: 0.5, marginBottom: spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.lg },
    presetItem: { width: '22%', alignItems: 'center' },
    presetCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    presetEmoji: { fontSize: 26 },
  });
}
