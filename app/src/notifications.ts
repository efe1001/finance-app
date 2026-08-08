import { Alert } from 'react-native';
import {
  getMessaging,
  requestPermission,
  hasPermission,
  getToken,
  onMessage,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

// True only if the user has never been asked before (Android's default before
// the first request, and iOS before its one-shot system prompt) — lets the
// caller decide whether to show a branded explanation first, without ever
// re-prompting someone who already said yes or no. Defaults to true on any
// failure (e.g. the native Firebase module not fully ready yet) rather than
// silently never showing the prompt at all - worst case we ask once more.
export async function isPushPermissionUndetermined() {
  try {
    const status = await hasPermission(getMessaging());
    return status === AuthorizationStatus.NOT_DETERMINED;
  } catch (e) {
    console.log('isPushPermissionUndetermined failed:', e);
    return true;
  }
}

export async function initPushNotifications(onToken: (token: string) => void) {
  try {
    const messaging = getMessaging();
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL;

    if (!enabled) return;

    const token = await getToken(messaging);
    onToken(token);

    // Android/iOS only show a system-tray notification when the app is backgrounded
    // or closed — while it's open in the foreground, Firebase just delivers the
    // message to this handler silently, so without this the user would see nothing.
    return onMessage(messaging, async remoteMessage => {
      const title = remoteMessage.notification?.title ?? 'Finance App';
      const body = remoteMessage.notification?.body ?? '';
      Alert.alert(title, body);
    });
  } catch (e) {
    console.log('initPushNotifications failed:', e);
  }
}
