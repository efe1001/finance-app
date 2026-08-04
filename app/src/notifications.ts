import messaging from '@react-native-firebase/messaging';

export async function initPushNotifications(onToken: (token: string) => void) {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) return;

  const token = await messaging().getToken();
  onToken(token);

  return messaging().onMessage(async remoteMessage => {
    console.log('Push received in foreground:', remoteMessage);
  });
}
