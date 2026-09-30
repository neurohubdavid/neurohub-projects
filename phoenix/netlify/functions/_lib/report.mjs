// Builds the readable "wellbeing and identity over time" report from the check-ins people chose to share.
// Pure functions, unit tested. Everything is group-level: a number based on fewer than MIN_N people is never shown, and no
// individual's scores appear anywhere in the report or its PDF.
import { summarise, MEASURES, MIN_N } from './cohort.mjs';

export const NAMES = ['Overall wellbeing', 'Senses and environment', 'Daily living', 'Social connection', 'Emotions', 'Identity and autonomy', 'Strengths and capacity'];
const OVERALL = 0, IDENTITY = 5;
const DAY = 86400000, t = (day) => Date.parse(day + 'T00:00:00Z');
const mean = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 100) / 100 : null);
const days = (p) => Object.keys(p.days).sort();
const fmt = (n) => (n == null ? 'n/a' : (Math.round(n * 10) / 10).toFixed(1));
const signed = (n) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n * 10) / 10).toFixed(1)}`;

/** Scores by how long each person has been using Phoenix (weeks since their own first check-in), so groups that started at different times line up. */
export function byTenure(participants, { maxWeeks = 12, minN = MIN_N } = {}) {
  const perWeek = Array.from({ length: maxWeeks + 1 }, () => []);
  for (const p of participants) {
    const ds = days(p); if (!ds.length) continue;
    const start = t(ds[0]), buckets = new Map();
    for (const d of ds) { const k = Math.floor((t(d) - start) / (7 * DAY)); if (k > maxWeeks) continue; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p.days[d]); }
    for (const [k, entries] of buckets) perWeek[k].push(MEASURES.map((_, i) => mean(entries.map((e) => e[i]))));
  }
  return perWeek.map((rows, k) => ({ k, n: rows.length >= minN ? rows.length : (rows.length ? '<' + minN : 0), means: rows.length >= minN ? MEASURES.map((_, i) => mean(rows.map((r) => r[i]))) : null }));
}

/** Change from first to latest check-in, split by how often people have checked in. Bands with fewer than minN people are hidden. */
export function byUsage(participants, { minN = MIN_N } = {}) {
  const bands = [['2 to 4 check-ins', 2, 4], ['5 to 14 check-ins', 5, 14], ['15 or more check-ins', 15, Infinity]];
  return bands.map(([label, lo, hi]) => {
    const ps = participants.filter((p) => { const n = days(p).length; return n >= lo && n <= hi && t(days(p)[days(p).length - 1]) - t(days(p)[0]) >= 7 * DAY; });
    if (ps.length < minN) return { label, n: ps.length ? '<' + minN : 0, first: null, latest: null, delta: null };
    const first = MEASURES.map((_, i) => mean(ps.map((p) => p.days[days(p)[0]][i]))), latest = MEASURES.map((_, i) => mean(ps.map((p) => { const d = days(p); return p.days[d[d.length - 1]][i]; })));
    return { label, n: ps.length, first, latest, delta: latest.map((v, i) => Math.round((v - first[i]) * 100) / 100) };
  });
}

export function buildReport(participants, { now = new Date(), weeks = 12, minN = MIN_N, devices = null } = {}) {
  const s = summarise(participants, { now, weeks, minN }), tenure = byTenure(participants, { maxWeeks: weeks, minN }), usage = byUsage(participants, { minN });
  const all = participants.flatMap((p) => days(p)).sort();
  const spans = participants.map((p) => (days(p).length ? (t(days(p).at(-1)) - t(days(p)[0])) / DAY : 0)).sort((a, b) => a - b);
  const sample = { devices, participants: participants.length, checkins: s.checkins, from: all[0] || null, to: all.at(-1) || null, medianDaysInApp: spans.length ? Math.round(spans[Math.floor(spans.length / 2)]) : 0 };

  const headlines = [];
  if (devices != null) headlines.push(`Phoenix has been opened on ${devices} device${devices === 1 ? '' : 's'} since launch. There are no accounts, so this counts devices, not people: someone using two devices counts twice.${devices >= minN && participants.length ? `  ${participants.length} people (about ${Math.round((participants.length / devices) * 100)}% of that number) have chosen to share their check-in scores.` : ''}`);
  headlines.push(sample.participants
    ? `${sample.participants} ${sample.participants === 1 ? 'person has' : 'people have'} shared ${sample.checkins} check-ins between ${sample.from} and ${sample.to}. ${s.retention.atLeast2} have shared more than once, and ${s.activeLast7} shared in the last 7 days.`
    : 'Nobody has chosen to share their check-in scores yet.');
  if (s.change) {
    const c = s.change;
    headlines.push(`Among the ${c.n} people who shared over at least a week (on average ${c.meanDays} days apart), overall wellbeing moved from ${fmt(c.firstMean[OVERALL])} to ${fmt(c.latestMean[OVERALL])} out of 5 (${signed(c.delta[OVERALL])}).`);
    headlines.push(`Sense of identity and autonomy moved from ${fmt(c.firstMean[IDENTITY])} to ${fmt(c.latestMean[IDENTITY])} out of 5 (${signed(c.delta[IDENTITY])}).`);
    const same = c.n - c.improved[OVERALL] - c.declined[OVERALL];
    headlines.push(`For overall wellbeing, ${c.improved[OVERALL]} of ${c.n} people ended higher than they started, ${same} stayed the same and ${c.declined[OVERALL]} ended lower. For identity, ${c.improved[IDENTITY]} ended higher, ${c.n - c.improved[IDENTITY] - c.declined[IDENTITY]} the same and ${c.declined[IDENTITY]} lower.`);
    const areas = MEASURES.map((_, i) => i).filter((i) => i !== OVERALL).sort((a, b) => c.delta[b] - c.delta[a]);
    headlines.push(`Of the six areas, ${NAMES[areas[0]].toLowerCase()} changed most in the positive direction (${signed(c.delta[areas[0]])}) and ${NAMES[areas[5]].toLowerCase()} the least (${signed(c.delta[areas[5]])}).`);
  } else headlines.push(`There are not yet enough people who have shared over a week or more to report change (at least ${minN} are needed).`);
  const shown = tenure.filter((w) => w.means);
  if (shown.length >= 2 && shown[0].k === 0) {
    const last = shown.at(-1);
    headlines.push(`Measured from each person's own first check-in, overall wellbeing averaged ${fmt(shown[0].means[OVERALL])} in week 1 and ${fmt(last.means[OVERALL])} by week ${last.k + 1} (${last.n} people); identity averaged ${fmt(shown[0].means[IDENTITY])} and ${fmt(last.means[IDENTITY])}.`);
  }
  const lo = usage.find((b) => b.delta), hiBand = [...usage].reverse().find((b) => b.delta);
  if (lo && hiBand && lo !== hiBand) headlines.push(`People who checked in more often changed by ${signed(hiBand.delta[OVERALL])} in overall wellbeing (${hiBand.label}) compared with ${signed(lo.delta[OVERALL])} for ${lo.label}. This is a pattern, not proof that using Phoenix more causes the difference.`);

  const notes = [
    `Scores are people's own ratings from 1 (really struggling) to 5 (thriving), given when they choose to check in. Overall wellbeing is one rating; identity and autonomy is one of the six areas.`,
    `Only people who chose to share are included. They are not a random sample of everyone who uses Phoenix, and people who feel worse may check in less often, so results may look better or worse than the whole picture.`,
    `Changes are between a person's own first and latest check-ins. They show how scores moved while people used Phoenix, not what caused the movement. Other things in people's lives change too.`,
    `Numbers are hidden whenever fewer than ${minN} people are behind them, each person counts once per week, and no individual's scores appear in this report.`,
    `This report is for NeuroHub's own understanding and service improvement. Anything published must be anonymous and combined, and should say how many people it is based on.`,
  ];
  return { generated: now.toISOString(), minN, measures: MEASURES, names: NAMES, sample, weekly: s.weekly, tenure, usage, change: s.change, headlines, notes };
}
