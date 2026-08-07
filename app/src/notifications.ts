import { Alert } from 'react-native';
import {
  getMessaging,
  requestPermission,
  getToken,
  onMessage,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

export async function initPushNotifications(onToken: (token: string) => void) {
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
}
