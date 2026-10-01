// Anonymous usage counts for NeuroHub: app opens, first opens, installs, which kind of AI is chosen, donate clicks.
// Each event adds 1 to a daily total on NeuroHub's server (netlify/functions/hit.mjs). No cookies, no identifier, no IP, no message,
// check-in or document content. Nothing is sent if the person switched it off in Settings, if the browser says Do Not Track or
// Global Privacy Control, when developing locally, or when the app is being driven by a test. Explained on the website's privacy page.
// (store.js is loaded on demand, so this file can be imported anywhere, including tests.)

const isWeb = typeof location !== 'undefined' && /^https?:/.test(location.protocol);
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export const analyticsAllowed = (state) => state.prefs.analytics !== false && navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl && !navigator.webdriver && !(isWeb && /^(localhost|127\.|\[::1\])/.test(location.hostname));

export async function track(e, v) {
  try {
    const { state } = await import('./store.js');
    if (!analyticsAllowed(state)) return;
    const url = `${location.origin}/api/hit`, body = JSON.stringify(isEmbedded() ? { e, v: String(v), h: embedHost() } : { e, v: String(v) }); // inside the widget, also which website it is on
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    else fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => {});
  } catch { /* counting must never break the app */ }
}

/** Is Phoenix running inside the floating widget on someone else's website (the /embed/ page)? */
export const isEmbedded = () => isWeb && /^\/embed(\/|$)/.test(location.pathname);
/** The website the widget is on, as the widget told us (a clean host name only; the server checks it again). */
export const embedHost = () => { try { return (new URLSearchParams(location.search).get('h') || '').toLowerCase().slice(0, 60); } catch { return ''; } };
const trackHost = (e, v) => { // like track(), plus the name of the website the widget is on
  if (!isEmbedded()) return track(e, v);
  import('./store.js').then(({ state }) => {
    if (!analyticsAllowed(state)) return;
    const body = JSON.stringify({ e, v: String(v), h: embedHost() });
    if (navigator.sendBeacon) navigator.sendBeacon(`${location.origin}/api/hit`, new Blob([body], { type: 'text/plain' }));
  }).catch(() => {});
};

/** Counts that one named thing was used (a tool, a check-in, a document...). Only names the server knows are counted; nothing typed is ever sent. */
export function trackFeature(name) { track('feature', name); }
/** Counts a message sent from the floating widget on a website. */
export function trackEmbedChat() { if (isEmbedded()) trackHost('embed_chat', 'ok'); }

const displayMode = () => (isEmbedded() ? 'embed' : matchMedia('(display-mode: standalone)').matches || navigator.standalone === true ? 'installed' : 'browser');

/** Once per session: an app open; once ever per device: a first open; once a day: which kind of AI is in use. */
export async function trackStart() {
  const { state } = await import('./store.js');
  const mode = displayMode();
  track('app_open', mode);
  if (mode === 'embed') trackHost('embed_open', new URLSearchParams(location.search).get('a') === '1' ? 'auto' : 'ok'); // 'auto': the chat was showing because the widget starts open, not because the visitor opened it
  if (!lsGet('phoenix.counted')) { track('first_open', mode); lsSet('phoenix.counted', '1'); }
  const today = new Date().toISOString().slice(0, 10);
  if (lsGet('phoenix.aiKindDay') !== today) { track('ai_kind', state.provider.kind); lsSet('phoenix.aiKindDay', today); }
}
