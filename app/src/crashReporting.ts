import { getCrashlytics, recordError, setUserId, log, type Crashlytics } from '@react-native-firebase/crashlytics';

// Lazily resolved on first use, not at module load - calling into the native
// module before Firebase's own native init has finished can crash the whole
// app before a single screen renders. Every entry point below is wrapped so
// a crash-reporting failure can never itself cause a crash.
let crashlytics: Crashlytics | null | undefined;
function getInstance(): Crashlytics | null {
  if (crashlytics !== undefined) return crashlytics;
  try {
    crashlytics = getCrashlytics();
  } catch {
    crashlytics = null;
  }
  return crashlytics;
}

export function initCrashReporting() {
  try {
    const previousHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error, isFatal) => {
      const instance = getInstance();
      if (instance) {
        try {
          recordError(instance, error);
        } catch {
          // swallow - reporting the crash must never block handling it
        }
      }
      previousHandler(error, isFatal);
    });
  } catch {
    // best-effort
  }
}

export function identifyCrashUser(userId: number | string) {
  const instance = getInstance();
  if (!instance) return;
  try {
    setUserId(instance, String(userId)).catch(() => {});
  } catch {
    // best-effort
  }
}

export function logBreadcrumb(message: string) {
  const instance = getInstance();
  if (!instance) return;
  try {
    log(instance, message);
  } catch {
    // best-effort
  }
}
