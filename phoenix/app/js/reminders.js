// The daily check-in reminder. Phoenix has no server, so reminders come from three places, best available first:
//  - installed web app: a notification when the browser allows background checks, and whenever Phoenix is open
//  - any device: a repeating daily event you can add to your own calendar (an .ics file), which always works
// The person chooses the time, can turn it off, and gets at most one reminder a day. None of this leaves the device.
import { state, save } from './store.js';
import { dayKey, download } from './util.js';
import { checkedInToday, reminderMessage, dailyIcs } from './sixpf.js';

const CFG_CACHE = 'phoenix-config';
let timer = null;

export const notifSupport = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
export const validTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

async function pushConfig() {
  const r = state.reminders;
  try { // the service worker reads this when the browser wakes it up in the background
    const c = await caches.open(CFG_CACHE);
    await c.put('config.json', new Response(JSON.stringify({ enabled: r.enabled, time: r.time, shownDay: r.lastShown, doneDay: checkedInToday(state.wellness) ? dayKey(new Date()) : '' }), { headers: { 'content-type': 'application/json' } }));
  } catch { /* no cache API */ }
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg?.periodicSync) {
      if (r.enabled) await reg.periodicSync.register('phoenix-daily', { minInterval: 6 * 3600 * 1000 });
      else await reg.periodicSync.unregister('phoenix-daily');
    }
  } catch { /* not allowed or not supported: the calendar file and in-app reminders still work */ }
}

/** Turn the reminder on or off / change its time. Returns {ok, message}. */
export async function setReminder({ enabled, time, launch }) {
  const r = state.reminders;
  if (time != null) { if (!validTime(time)) return { ok: false, message: 'Pick a time like 10:00.' }; r.time = time; r.lastShown = ''; }
  if (launch != null) r.launch = !!launch;
  let message = '';
  if (enabled != null) {
    if (enabled) {
      if (typeof Notification === 'undefined') message = 'This browser cannot show notifications, so Phoenix will remind you inside the app. To get a reminder anywhere, add the daily event to your calendar.';
      else if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* ignore */ } }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') message = 'Notifications are blocked for Phoenix in this browser. You can allow them in the site settings, or add the daily event to your calendar instead.';
    }
    r.enabled = !!enabled;
  }
  save(); await pushConfig(); startTicker();
  return { ok: true, message };
}

async function show(title, body) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) { await reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'phoenix-daily', data: { hash: '#/checkin' } }); return true; }
  } catch { /* fall back */ }
  try { const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'phoenix-daily' }); n.onclick = () => { window.focus(); location.hash = '#/checkin'; }; return true; } catch { return false; }
}

export async function testReminder() {
  if (typeof Notification === 'undefined') return false;
  if (Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* ignore */ } }
  if (Notification.permission !== 'granted') return false;
  return show('Phoenix reminders are working', 'This is what your daily reminder will look like. Tap to open the check-in.');
}

/** Called while the web app is open: one gentle notification a day, after the chosen time, only if not checked in yet. */
async function tick() {
  const r = state.reminders;
  if (!r.enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const now = new Date(), [h, m] = r.time.split(':').map(Number), today = dayKey(now);
  if (r.lastShown === today || checkedInToday(state.wellness, now) || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) { r.lastShown = today; save(); pushConfig(); return; } // they are here already, the chat banner covers it
  const { title, body } = reminderMessage(Math.floor(Date.now() / 86400000));
  if (await show(title, body)) { r.lastShown = today; save(); pushConfig(); }
}
function startTicker() {
  clearInterval(timer); timer = null;
  if (!state.reminders.enabled) return;
  timer = setInterval(tick, 60000); tick();
}

/** Boot: sync settings to the service worker, and start the in-app ticker. */
export function initReminders() {
  pushConfig(); startTicker();
  globalThis.__reminders = { tick, state: () => ({ ...state.reminders }), pushConfig }; // test hook
}
/** After a check-in: tell the scheduler so today's reminder is skipped. */
export function nudgeAfterCheckin() { pushConfig(); }

export function downloadIcs() {
  const url = /^https?:/.test(location.protocol) ? new URL('./#/checkin', location.href).href : '';
  download('phoenix-daily-checkin.ics', dailyIcs(state.reminders.time, url), 'text/calendar');
}
