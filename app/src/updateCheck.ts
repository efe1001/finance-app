import { APP_VERSION } from './appVersion';

export type UpdateInfo = { version: string; url: string; notes: string };

const RELEASES_URL = 'https://api.github.com/repos/efe1001/finance-app/releases/latest';

function isNewer(remote: string, current: string) {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

// Returns update info if a newer release is available on GitHub, otherwise null.
// Best-effort: any network/parse failure is treated as "no update available"
// rather than surfaced as an error, since this check is a background nicety.
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(RELEASES_URL);
    if (!res.ok) return null;
    const data = await res.json();
    const remoteVersion = String(data.tag_name || '').replace(/^v/, '');
    const apk = (data.assets || []).find((a: any) => a.name?.endsWith('.apk'));
    if (!remoteVersion || !apk || !isNewer(remoteVersion, APP_VERSION)) return null;
    return { version: remoteVersion, url: apk.browser_download_url, notes: data.body || '' };
  } catch {
    return null;
  }
}
