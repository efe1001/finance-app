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

  return onMessage(messaging, async remoteMessage => {
    console.log('Push received in foreground:', remoteMessage);
  });
}
