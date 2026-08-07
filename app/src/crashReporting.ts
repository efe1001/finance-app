import { getCrashlytics, recordError, setUserId, log } from '@react-native-firebase/crashlytics';

const crashlytics = getCrashlytics();

export function initCrashReporting() {
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    recordError(crashlytics, error);
    previousHandler(error, isFatal);
  });
}

export function identifyCrashUser(userId: number | string) {
  setUserId(crashlytics, String(userId)).catch(() => {});
}

export function logBreadcrumb(message: string) {
  log(crashlytics, message);
}
