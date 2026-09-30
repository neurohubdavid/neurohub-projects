// Phoenix has no accounts, so "users" are counted as devices: the first time the app opens on a device it adds one to a daily total
// (netlify/functions/hit.mjs). Nothing identifies a person or a device, so one person on two devices counts twice, and clearing
// browser data counts again. That is the honest limit of counting without tracking.
import { dayOf, readDayCounts } from './kv.mjs';

export const LAUNCH = '2026-09-28';
const DAY = 86400000;

/** Adds up the daily counters from launch until today. Returns { totals, days: [{day, counts}] } for every day since launch (capped at 800 days). */
export async function sinceLaunch(stats, now = new Date(), launch = LAUNCH) {
  const days = [], first = Math.max(Date.parse(launch + 'T00:00:00Z'), now.getTime() - 800 * DAY);
  for (let t = first; t <= now.getTime(); t += DAY) { const day = dayOf(new Date(t)); days.push({ day, counts: await readDayCounts(stats, day) }); }
  const totals = {}; for (const d of days) for (const [k, v] of Object.entries(d.counts)) totals[k] = (totals[k] || 0) + v;
  return { totals, days };
}
const inLast = (days, n, name) => days.slice(-n).reduce((s, d) => s + (d.counts[name] || 0), 0);
const top = (t, prefix) => Object.entries(t).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [k.slice(prefix.length), v]).sort((a, b) => b[1] - a[1]);

/** The "users" numbers for the backend. */
export function usersSummary({ totals, days }) {
  return {
    devicesAllTime: totals['e:first_open'] || 0,
    newDevices: { last1: inLast(days, 1, 'e:first_open'), last7: inLast(days, 7, 'e:first_open'), last30: inLast(days, 30, 'e:first_open') },
    appOpens: { last1: inLast(days, 1, 'e:app_open'), last7: inLast(days, 7, 'e:app_open'), last30: inLast(days, 30, 'e:app_open'), allTime: totals['e:app_open'] || 0 },
    installedAsApp: totals['e:installed'] || 0,
    downloads: totals['e:download'] || 0,
    byPlatform: top(totals, 'plat:first_open:'), byHowUsed: top(totals, 'e:first_open:'), byCountry: top(totals, 'country:first_open:').slice(0, 15),
    newDevicesPerDay: days.slice(-60).map((d) => ({ day: d.day, n: d.counts['e:first_open'] || 0, opens: d.counts['e:app_open'] || 0 })),
    since: days[0]?.day || null,
  };
}
