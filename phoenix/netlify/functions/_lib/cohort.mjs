// Turns the check-ins that people chose to share into what the backend shows: how the group is doing week by week, how many
// people keep coming back, and how people change between their first and latest check-in. Pure functions, unit tested.
// Small groups are hidden: any number based on fewer than MIN_N people is returned as null, so a single person can never be picked
// out of a chart.
export const MIN_N = 5;
export const MEASURES = ['mood', 'sensory', 'executive', 'social', 'emotional', 'identity', 'strengths'];

const DAY = 86400000;
const t = (day) => Date.parse(day + 'T00:00:00Z');
export const weekStart = (day) => { const d = new Date(t(day)); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const mean = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : null);
const sortedDays = (p) => Object.keys(p.days).sort();

/** participants: [{id, c, days: {'YYYY-MM-DD': [mood, sensory, executive, social, emotional, identity, strengths]}}] */
export function summarise(participants, { now = new Date(), weeks = 12, minN = MIN_N } = {}) {
  const today = now.toISOString().slice(0, 10), from = new Date(t(today) - (weeks * 7 - 1) * DAY).toISOString().slice(0, 10);
  const out = { minN, participants: participants.length, checkins: 0, activeLast7: 0, retention: { atLeast2: 0, atLeast7: 0 }, weekly: [], latest: null, change: null };
  const perWeek = new Map();
  for (const p of participants) {
    const days = sortedDays(p);
    out.checkins += days.length;
    if (days.length >= 2) out.retention.atLeast2++;
    if (days.length >= 7) out.retention.atLeast7++;
    if (days.length && t(today) - t(days[days.length - 1]) < 7 * DAY) out.activeLast7++;
    for (const d of days) {
      if (d < from || d > today) continue;
      const w = weekStart(d);
      if (!perWeek.has(w)) perWeek.set(w, new Map());
      const pw = perWeek.get(w);
      if (!pw.has(p.id)) pw.set(p.id, []);
      pw.get(p.id).push(p.days[d]);
    }
  }
  // Each person counts once per week (their average that week), so someone who checks in every day does not outweigh everyone else.
  for (let w = weekStart(from); w <= today; w = new Date(t(w) + 7 * DAY).toISOString().slice(0, 10)) {
    const pw = perWeek.get(w) || new Map(), rows = [...pw.values()].map((entries) => MEASURES.map((_, i) => mean(entries.map((e) => e[i]))));
    const n = rows.length, show = n >= minN;
    out.weekly.push({ week: w, n: show ? n : (n ? '<' + minN : 0), means: show ? MEASURES.map((_, i) => mean(rows.map((r) => r[i]))) : null });
  }
  const lat = participants.map((p) => { const d = sortedDays(p); return d.length ? p.days[d[d.length - 1]] : null; }).filter(Boolean);
  if (lat.length >= minN) out.latest = { n: lat.length, overallCounts: [1, 2, 3, 4, 5].map((v) => lat.filter((e) => e[0] === v).length), means: MEASURES.map((_, i) => mean(lat.map((e) => e[i]))) };
  const paired = participants.filter((p) => { const d = sortedDays(p); return d.length >= 2 && t(d[d.length - 1]) - t(d[0]) >= 7 * DAY; });
  if (paired.length >= minN) out.change = { n: paired.length, firstMean: MEASURES.map((_, i) => mean(paired.map((p) => p.days[sortedDays(p)[0]][i]))), latestMean: MEASURES.map((_, i) => mean(paired.map((p) => { const d = sortedDays(p); return p.days[d[d.length - 1]][i]; }))), meanDays: Math.round(mean(paired.map((p) => { const d = sortedDays(p); return (t(d[d.length - 1]) - t(d[0])) / DAY; }))), delta: MEASURES.map((_, i) => mean(paired.map((p) => { const d = sortedDays(p); return p.days[d[d.length - 1]][i] - p.days[d[0]][i]; }))), improved: MEASURES.map((_, i) => paired.filter((p) => { const d = sortedDays(p); return p.days[d[d.length - 1]][i] > p.days[d[0]][i]; }).length), declined: MEASURES.map((_, i) => paired.filter((p) => { const d = sortedDays(p); return p.days[d[d.length - 1]][i] < p.days[d[0]][i]; }).length) };
  return out;
}

/** Pseudonymous individual lines (overall score by day) for the owner. Hidden until there are enough people that none can be singled out. */
export function trajectories(participants, { minN = MIN_N, max = 60 } = {}) {
  if (participants.length < minN) return null;
  return participants.filter((p) => Object.keys(p.days).length >= 2).sort((a, b) => Object.keys(b.days).length - Object.keys(a.days).length).slice(0, max)
    .map((p, i) => ({ label: 'P' + (i + 1), days: sortedDays(p).map((d) => [d, p.days[d][0]]) }));
}

/** Checks one shared check-in as it arrives. Only seven whole numbers from 1 to 5 and a recent date get through, never text. */
export function cleanEntry(body, now = new Date()) {
  const day = String(body?.at || ''), s = body?.s;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(t(day))) return null;
  const age = (t(now.toISOString().slice(0, 10)) - t(day)) / DAY;
  if (age < -1 || age > 730) return null;
  if (!Array.isArray(s) || s.length !== 7 || !s.every((v) => Number.isInteger(v) && v >= 1 && v <= 5)) return null;
  return { day, scores: s };
}
export const validPid = (pid) => /^[a-f0-9]{32}$/.test(String(pid || ''));
