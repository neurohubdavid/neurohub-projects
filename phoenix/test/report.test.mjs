// The readable wellbeing-and-identity report and its PDF.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as lib from '../app/vendor/pdf-lib.esm.min.js';
import { buildReport, byTenure, byUsage } from '../netlify/functions/_lib/report.mjs';
import { makeReportPdf } from '../scripts/site-assets/admin-pdf.js';

const NOW = new Date('2026-12-15T12:00:00Z');
const dayN = (start, n) => new Date(Date.parse(start + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const clamp = (v) => Math.max(1, Math.min(5, Math.round(v)));
/** A made-up group: overall rises a little, identity rises more, and people who check in more often improve more. */
function people(n) {
  return Array.from({ length: n }, (_, i) => {
    const start = dayN('2026-09-07', (i % 5) * 3), count = 2 + (i % 4) * 6, days = {};
    for (let k = 0; k < count; k++) {
      const d = dayN(start, Math.round((k / Math.max(1, count - 1)) * 70)), progress = k / Math.max(1, count - 1), boost = count > 10 ? 1.4 : 0.5;
      const base = 2.2 + progress * boost + rnd() * 0.6, idn = 2 + progress * (boost + 0.8) + rnd() * 0.6;
      days[d] = [clamp(base), clamp(base), clamp(base), clamp(base), clamp(base), clamp(idn), clamp(base)];
    }
    return { id: 'p' + i, days };
  });
}

test('report: readable findings from a group of people, with identity called out', () => {
  const r = buildReport(people(24), { now: NOW });
  assert.equal(r.sample.participants, 24); assert.ok(r.sample.checkins > 100 && r.sample.from && r.sample.to);
  const text = r.headlines.join(' ');
  assert.match(text, /24 people have shared/); assert.match(text, /overall wellbeing moved from [\d.]+ to [\d.]+ out of 5/); assert.match(text, /identity and autonomy moved from/i);
  assert.match(text, /ended higher than they started/); assert.match(text, /not proof that using Phoenix more causes/);
  assert.ok(r.change.delta[5] > r.change.delta[0] - 0.01, 'identity rises at least as much as overall in this made-up group');
  assert.ok(r.tenure.filter((w) => w.means).length >= 3, 'week-in-app series is built');
  assert.ok(r.notes.some((n) => /not a random sample/.test(n)) && r.notes.some((n) => /not what caused/.test(n)), 'honest limits are always included');
  assert.equal(r.tenure[0].means.length, 7); assert.equal(r.names.length, 7);
});

test('report: small groups are never reported on, and no individual appears', () => {
  const few = buildReport(people(4), { now: NOW });
  assert.equal(few.change, null); assert.ok(few.tenure.every((w) => w.means === null)); assert.ok(few.usage.every((b) => b.delta === null));
  assert.match(few.headlines.join(' '), /not yet enough people/i);
  const none = buildReport([], { now: NOW }); assert.match(none.headlines[0], /Nobody has chosen/);
  const r = buildReport(people(24), { now: NOW }), json = JSON.stringify(r);
  assert.ok(!/"id"|p\d+|pid/.test(json.replace(/"participants"/g, '')), 'no identifiers in the report');
  for (const b of r.usage) if (b.n !== 0 && typeof b.n === 'string') assert.equal(b.delta, null, 'a hidden band shows no numbers');
});

test('report: tenure lines people up from their own first check-in, and bands split by how often people checked in', () => {
  const a = [1, 2, 3, 4, 5].map((i) => ({ id: 'a' + i, days: { [dayN('2026-01-01', i * 9)]: [2, 2, 2, 2, 2, 2, 2], [dayN('2026-01-01', i * 9 + 8)]: [4, 4, 4, 4, 4, 4, 4] } }));
  const t = byTenure(a, { maxWeeks: 4 });
  assert.equal(t[0].n, 5); assert.equal(t[0].means[0], 2); assert.equal(t[1].n, 5); assert.equal(t[1].means[0], 4, 'people who started on different dates line up');
  const u = byUsage(people(24));
  assert.ok(u[0].delta && u[2].delta, 'bands with enough people have numbers'); assert.ok(u[2].delta[0] >= u[0].delta[0] - 0.5);
});

test('report: the PDF is a real multi-section A4 document', async () => {
  const r = buildReport(people(30), { now: NOW });
  const out = await makeReportPdf(r, { lib, logoBytes: fs.readFileSync(new URL('../app/icons/icon-192.png', import.meta.url)) });
  assert.equal(Buffer.from(out.bytes.slice(0, 5)).toString(), '%PDF-'); assert.ok(out.pages >= 2 && out.pages <= 6, 'pages: ' + out.pages);
  const empty = await makeReportPdf(buildReport([], { now: NOW }), { lib });
  assert.equal(Buffer.from(empty.bytes.slice(0, 5)).toString(), '%PDF-', 'even with no data it makes a readable PDF that says so');
  if (process.env.SAVE_PDF) fs.writeFileSync(process.env.SAVE_PDF, out.bytes);
});


test('users: devices are counted from the anonymous first-open totals, with a clear limit', async () => {
  const { sinceLaunch, usersSummary } = await import('../netlify/functions/_lib/usage.mjs');
  const { memoryStore } = await import('../netlify/functions/_lib/kv.mjs');
  const store = memoryStore(), now = new Date('2026-10-10T10:00:00Z');
  await store.set('day:2026-09-29', JSON.stringify({ 'e:first_open': 5, 'e:app_open': 9, 'plat:first_open:android': 3, 'plat:first_open:windows': 2, 'e:first_open:browser': 4, 'e:first_open:installed': 1, 'country:first_open:GB': 5, 'e:installed': 1, 'e:download': 2 }));
  await store.set('day:2026-10-09', JSON.stringify({ 'e:first_open': 2, 'e:app_open': 4 })); await store.set('day:2026-10-10', JSON.stringify({ 'e:first_open': 1, 'e:app_open': 3 }));
  const u = usersSummary(await sinceLaunch(store, now));
  assert.equal(u.devicesAllTime, 8); assert.equal(u.newDevices.last1, 1); assert.equal(u.newDevices.last7, 3); assert.equal(u.newDevices.last30, 8);
  assert.equal(u.appOpens.allTime, 16); assert.equal(u.appOpens.last7, 7); assert.equal(u.installedAsApp, 1); assert.equal(u.downloads, 2);
  assert.deepEqual(u.byPlatform[0], ['android', 3]); assert.deepEqual(u.byCountry[0], ['GB', 5]); assert.ok(u.since && u.newDevicesPerDay.length);
  const r = buildReport(people(24), { now: NOW, devices: 120 });
  assert.equal(r.sample.devices, 120); assert.match(r.headlines[0], /120 devices/); assert.match(r.headlines[0], /not people/); assert.match(r.headlines[0], /24 people \(about 20%/);
  assert.equal(buildReport(people(24), { now: NOW }).sample.devices, null, 'without a device count the report simply leaves it out');
});