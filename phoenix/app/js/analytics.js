// Anonymous usage counts for NeuroHub: app opens, first opens, installs, which kind of AI is chosen, donate clicks.
// Each event adds 1 to a daily total on NeuroHub's server (netlify/functions/hit.mjs). No cookies, no identifier, no IP, no message,
// check-in or document content. Nothing is sent if the person switched it off in Settings, if the browser says Do Not Track or
// Global Privacy Control, when developing locally, or when the app is being driven by a test. Explained on the website's privacy page.
// (store.js is loaded on demand, so this file can be imported anywhere, including tests.)

const HOME = 'https://phoenix.neurohubcommunity.org';
const isWeb = typeof location !== 'undefined' && /^https?:/.test(location.protocol);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const analyticsAllowed = (state) => state.prefs.analytics !== false && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl && !navigator.webdriver && !globalThis.phoenixNative?.noAnalytics && !(isWeb && /^(localhost|127\.|\[::1\])/.test(location.hostname));

export async function track(e, v) {
  try {
    const { state } = await import('./store.js');
    if (!analyticsAllowed(state)) return;
    const url = `${isWeb ? location.origin : HOME}/api/hit`, body = JSON.stringify({ e, v: String(v) });
    if (isWeb && navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    else { // the desktop app: go through its main process, since the app's own address is not allowed to call NeuroHub's server directly
      const { netFetch } = await import('./net.js');
      netFetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } }).catch(() => {});
    }
  } catch { /* counting must never break the app */ }
}

const displayMode = () => (globalThis.phoenixNative ? 'desktop' : matchMedia('(display-mode: standalone)').matches || navigator.standalone === true ? 'installed' : 'browser');

/** Once per session: an app open; once ever per device: a first open; once a day: which kind of AI is in use. */
export async function trackStart() {
  const { state } = await import('./store.js');
  const mode = displayMode();
  track('app_open', mode);
  if (!lsGet('phoenix.counted')) { track('first_open', mode); lsSet('phoenix.counted', '1'); }
  const today = new Date().toISOString().slice(0, 10);
  if (lsGet('phoenix.aiKindDay') !== today) { track('ai_kind', state.provider.kind); lsSet('phoenix.aiKindDay', today); }
}
