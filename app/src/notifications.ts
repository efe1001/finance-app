import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getMessaging,
  requestPermission,
  hasPermission,
  getToken,
  onMessage,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';

const PROMPT_SHOWN_KEY = 'pushPromptShown';

// Whether the branded "Enable Notifications" screen has ever been shown on
// this device. We can't rely on Firebase's own permission status for this on
// Android: hasPermission() there only ever resolves AUTHORIZED or DENIED
// (Android's notification permission is binary), never NOT_DETERMINED, so a
// device that's simply never been asked reads identically to one that said
// no - there's no way to tell those apart from the OS alone. Tracking it
// ourselves is the only reliable option.
export async function hasShownPushPrompt() {
  try {
    return (await AsyncStorage.getItem(PROMPT_SHOWN_KEY)) === '1';
  } catch (e) {
    console.log('hasShownPushPrompt failed:', e);
    return true; // fail closed - better to occasionally miss the prompt than loop it
  }
}

export async function markPushPromptShown() {
  try {
    await AsyncStorage.setItem(PROMPT_SHOWN_KEY, '1');
  } catch (e) {
    console.log('markPushPromptShown failed:', e);
  }
}

// True if this device currently has notification permission - safe to call
// anytime (never prompts), used to set the initial position of the Settings
// toggle and to decide what the toggle should do when switched on.
export async function checkPushPermissionGranted() {
  try {
    const status = await hasPermission(getMessaging());
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  } catch (e) {
    console.log('checkPushPermissionGranted failed:', e);
    return false;
  }
}

let foregroundListenerAttached = false;
function attachForegroundListener() {
  if (foregroundListenerAttached) return;
  foregroundListenerAttached = true;
  // Android/iOS only show a system-tray notification when the app is backgrounded
  // or closed - while it's open in the foreground, Firebase just delivers the
  // message to this handler silently, so without this the user would see nothing.
  onMessage(getMessaging(), async remoteMessage => {
    const title = remoteMessage.notification?.title ?? 'Finance App';
    const body = remoteMessage.notification?.body ?? '';
    Alert.alert(title, body);
  });
}

// Requests permission (shows the real OS prompt if not yet decided) and, if
// granted, fetches and hands back the device's push token. Returns whether
// the device ended up with permission granted, so callers (the Settings
// toggle, the first-run prompt) can react if the user says no.
export async function requestPushPermissionAndToken(onToken: (token: string) => void): Promise<boolean> {
  try {
    const messaging = getMessaging();
    const authStatus = await requestPermission(messaging);
    const enabled =
      authStatus === AuthorizationStatus.AUTHORIZED || authStatus === AuthorizationStatus.PROVISIONAL;
    if (!enabled) return false;

    const token = await getToken(messaging);
    onToken(token);
    attachForegroundListener();
    return true;
  } catch (e) {
    console.log('requestPushPermissionAndToken failed:', e);
    return false;
  }
}

export function promptToOpenSettingsForNotifications() {
  Alert.alert(
    'Notifications are blocked',
    "Your phone is blocking notifications for this app. Open Settings to allow them?",
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ],
  );
}
