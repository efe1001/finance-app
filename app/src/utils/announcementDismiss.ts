import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dismissedAnnouncementId';

// Tracked per-device rather than server-side "read" state - simpler, and an
// announcement banner reappearing after a reinstall is a fine trade-off for
// not needing a read-receipts table.
export async function getDismissedAnnouncementId(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export async function setDismissedAnnouncementId(id: number) {
  try {
    await AsyncStorage.setItem(KEY, String(id));
  } catch {
    // best-effort - worst case the banner shows again next launch
  }
}
