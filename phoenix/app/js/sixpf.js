// The 6PF-Wellness daily check-in: the same six domains, prompts and 1 to 5 scale as NeuroHub's client portal, plus the
// maths behind Phoenix's insights and advice. Pure functions with no DOM, so they are unit tested.
//
// An entry is stored in the portal's own shape so it could later be shared with a practitioner:
//   { id, createdAt (ISO), overallMood 1-5, domains: [{ id, label, rating 1-5, note }], urgentNote, protect }
// Nothing here leaves the device unless the person exports it.

export const DOMAINS = [
  { id: 'sensory', label: 'Sensory & Environment', short: 'Sensory', color: '#7C3AED', dash: '', prompt: 'How are your senses and surroundings feeling at the moment?', notePlaceholder: 'Sounds, light, textures, routines, spaces: anything you want to note?' },
  { id: 'executive', label: 'Executive Function & Daily Living', short: 'Daily living', color: '#2563EB', dash: '6 3', prompt: 'How manageable do everyday tasks and routines feel right now?', notePlaceholder: 'Planning, time, transitions, self-care: anything to add?' },
  { id: 'social', label: 'Social Communication & Connection', short: 'Social', color: '#0D9488', dash: '2 3', prompt: 'How are your social interactions and connections feeling?', notePlaceholder: 'Communication, relationships, socialising: anything to share?' },
  { id: 'emotional', label: 'Emotional Regulation & Wellbeing', short: 'Emotional', color: '#D97706', dash: '10 3 2 3', prompt: 'How would you rate your emotional wellbeing at the moment?', notePlaceholder: "Mood, stress, anxiety, or what's helping you recharge?" },
  { id: 'identity', label: 'Identity & Autonomy', short: 'Identity', color: '#E11D48', dash: '1 3', prompt: 'How connected do you feel to your sense of self and your choices?', notePlaceholder: 'Self-understanding, autonomy, control: anything to mention?' },
  { id: 'strengths', label: 'Strengths & Capacity', short: 'Strengths', color: '#EA580C', dash: '12 4', prompt: 'How able are you to draw on your strengths and support right now?', notePlaceholder: "Interests, strengths, or support that's helping you?" },
];
export const RATING_CAPTIONS = ['Really struggling', 'Finding it tough', 'Managing okay', 'Doing well', 'Thriving'];
export const MOOD_EMOJI = ['😔', '😕', '🙂', '😊', '🤩'];
export const MEASURES = [{ id: 'mood', label: 'Overall', short: 'Overall', color: '#16121f', dash: '' }, ...DOMAINS];

export function freshEntry() {
  return { id: '', createdAt: '', overallMood: 3, domains: DOMAINS.map((d) => ({ id: d.id, label: d.label, rating: 3, note: '' })), urgentNote: '', protect: '' };
}

// ---------------------------------------------------------------- dates
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);
export const val = (entry, measure) => (measure === 'mood' ? entry.overallMood : entry.domains.find((d) => d.id === measure)?.rating);

/** One entry per calendar day (the last one that day), oldest first. */
export function perDay(entries) {
  const m = new Map();
  for (const e of [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))) m.set(dayKey(e.createdAt), e);
  return [...m.values()];
}
export const checkedInToday = (entries, now = new Date()) => entries.some((e) => dayKey(e.createdAt) === dayKey(now));

/** Consecutive days with a check-in, counting back from today (or from yesterday, so today is not "broken" until it is over). */
export function streak(entries, now = new Date()) {
  const days = new Set(entries.map((e) => dayKey(e.createdAt)));
  let d = startOfDay(now), n = 0;
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function longestStreak(entries) {
  const ds = [...new Set(entries.map((e) => dayKey(e.createdAt)))].sort();
  let best = 0, run = 0, prev = null;
  for (const k of ds) { const cur = new Date(k + 'T00:00:00'); run = prev && daysBetween(prev, cur) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = cur; }
  return best;
}

// ---------------------------------------------------------------- statistics
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export const round1 = (n) => (n == null ? null : Math.round(n * 10) / 10);

/** Entries (one per day) in the last `days` days, or all of them if days is 0. */
export function inRange(entries, days, now = new Date()) {
  const pd = perDay(entries);
  if (!days) return pd;
  return pd.filter((e) => daysBetween(e.createdAt, now) < days && daysBetween(e.createdAt, now) >= 0);
}
/** The same length of time immediately before the range, to show change. */
export function previousRange(entries, days, now = new Date()) {
  if (!days) return [];
  return perDay(entries).filter((e) => { const d = daysBetween(e.createdAt, now); return d >= days && d < days * 2; });
}
export function averages(list) {
  const out = {};
  for (const m of MEASURES) out[m.id] = round1(mean(list.map((e) => val(e, m.id)).filter((x) => x != null)));
  return out;
}
export function changes(entries, days, now = new Date()) {
  const cur = averages(inRange(entries, days, now)), prev = averages(previousRange(entries, days, now));
  const out = {};
  for (const m of MEASURES) out[m.id] = cur[m.id] != null && prev[m.id] != null ? round1(cur[m.id] - prev[m.id]) : null;
  return { current: cur, previous: prev, change: out };
}
export function weekdayAverages(entries) {
  const sums = Array.from({ length: 7 }, () => []);
  for (const e of perDay(entries)) sums[(new Date(e.createdAt).getDay() + 6) % 7].push(e.overallMood); // Monday first
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => ({ label, avg: round1(mean(sums[i])), n: sums[i].length }));
}
export function pearson(xs, ys) {
  const n = xs.length; if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx === 0 || syy === 0 ? null : sxy / Math.sqrt(sxx * syy);
}
/** The strongest relationship between two measures across days. Needs enough data to mean anything. */
export function strongestLink(entries, { minDays = 8, minR = 0.55 } = {}) {
  const pd = perDay(entries);
  if (pd.length < minDays) return null;
  let best = null;
  for (let i = 0; i < DOMAINS.length; i++) for (let j = i + 1; j < DOMAINS.length; j++) {
    const a = DOMAINS[i], b = DOMAINS[j];
    const r = pearson(pd.map((e) => val(e, a.id)), pd.map((e) => val(e, b.id)));
    if (r != null && Math.abs(r) >= minR && (!best || Math.abs(r) > Math.abs(best.r))) best = { a, b, r: Math.round(r * 100) / 100, n: pd.length };
  }
  return best;
}
/** "up", "down" or "flat" comparing the last `k` check-ins with the `k` before. */
export function direction(entries, measure = 'mood', k = 3) {
  const v = perDay(entries).map((e) => val(e, measure));
  if (v.length < k * 2) return { dir: 'flat', delta: 0, enough: false };
  const delta = mean(v.slice(-k)) - mean(v.slice(-k * 2, -k));
  return { dir: delta >= 0.5 ? 'up' : delta <= -0.5 ? 'down' : 'flat', delta: round1(delta), enough: true };
}

/** Several domains slipping together, especially sensory, daily living and emotional: the early shape of burnout. */
export function burnoutSignals(entries) {
  const pd = perDay(entries);
  if (pd.length < 4) return { flag: false };
  const recent = pd.slice(-3), before = pd.slice(-8, -3);
  const avg = (list, id) => mean(list.map((e) => val(e, id)));
  const key = ['sensory', 'executive', 'emotional'];
  const lowNow = key.filter((id) => avg(recent, id) <= 2.4);
  const slipped = before.length >= 2 ? DOMAINS.filter((d) => avg(recent, d.id) - avg(before, d.id) <= -0.8).map((d) => d.id) : [];
  return { flag: lowNow.length >= 2 || slipped.length >= 3, lowNow, slipped };
}

// ---------------------------------------------------------------- advice (built in, no AI needed)
const link = (label, go) => ({ label, go });
const DOMAIN_ADVICE = {
  sensory: { title: 'Sensory load is heavy', text: 'Turn the input down before asking more of yourself: dimmer, quieter, softer clothes, headphones, less time in loud or bright places. Make or use a nest, and plan recovery time after busy places. A sensory reset works on the environment, not on you.', actions: [link('Sensory reset', 'tool:sensory'), link('Read: sensory overload', 'learn:sensory')] },
  executive: { title: 'Daily living feels hard', text: 'That is capacity, not character. Shrink the first step until it is almost silly, put reminders outside your head, work alongside someone (body doubling), and cut today to the must-dos. Pair a boring task with music, and stop while you still know what comes next.', actions: [link('Break a task down', 'tool:tasks'), link('Focus with Phoenix', 'tool:focus'), link('Read: getting started', 'learn:inertia')] },
  social: { title: 'Connection feels strained', text: 'Try contact that asks little: side by side, a text, sharing a meme or a link you thought of (penguin pebbling). It is fine to say no to things, and alone time is not avoidance. If nobody around you gets it, other neurodivergent people online often do.', actions: [link('Scripts for hard messages', 'tool:scripts'), link('Read: Autistic social culture', 'learn:ausocial')] },
  emotional: { title: 'Emotional wellbeing is low', text: 'Start with the body. Name sensations before feelings (tight chest, hot face), then give your body what it asks for: slow breathing, pressure, warmth, a drink, movement, quiet. A calm, safe person nearby helps (co-regulation). If it has stayed low for weeks, tell a professional who understands neurodivergence, and use the Help button any time.', actions: [link('Breathing', 'tool:breathing'), link('Grounding', 'tool:grounding'), link('Read: alexithymia', 'learn:alexithymia')] },
  identity: { title: 'Feeling cut off from yourself', text: 'Masking and constant demands can make it hard to feel like you. Take one small choice back today: what to eat, what to wear, what to skip. Spend a little time somewhere you do not have to perform, and notice one glimmer, a small thing that felt like you.', actions: [link('Read: masking and unmasking', 'learn:unmasking'), link('Read: glimmers', 'learn:glimmers')] },
  strengths: { title: 'Hard to reach your strengths and support', text: 'When capacity is low, strengths are the first thing to go quiet. Give your special interest some time. It is not a reward, it is how many of us recover. Ask one person for one small thing, and lower the demands so there is room for what you are good at.', actions: [link('Read: special interests', 'learn:specialinterests'), link('Focus with Phoenix', 'tool:focus')] },
};
export const PROTECT_IDEAS = {
  sensory: ['Leave the noisiest or brightest place early', 'Set up my nest before I need it', 'Wear the comfortable clothes'],
  executive: ['Do only the must-dos today', 'Set one alarm to eat and drink', 'Ask someone to sit with me while I start'],
  social: ['Say no to one thing without explaining', 'Take quiet time after seeing people', 'Send one low-effort message'],
  emotional: ['Ten quiet minutes with no demands', 'Move my body or stim for a few minutes', 'Do one thing that comforts me'],
  identity: ['Make one choice purely for me', 'Spend time on my special interest', 'Be unmasked with one safe person'],
  strengths: ['Use my strength on something small', 'Ask for one small piece of help', 'Rest without earning it first'],
  general: ['Protect my sleep tonight', 'Leave a gap between two things', 'Keep something for myself that nobody else can book'],
};

/**
 * Advice from recent check-ins. Deterministic and cautious: it describes patterns and offers small, low-demand options.
 * It never diagnoses, and it points to professional help and the Help button where that is warranted.
 */
export function advice(entries, now = new Date()) {
  const pd = perDay(entries);
  if (!pd.length) return [];
  const out = [];
  const last = pd[pd.length - 1];
  const recent = pd.slice(-3);
  const avgRecent = (id) => mean(recent.map((e) => val(e, id)));

  if (last.overallMood <= 1 || val(last, 'emotional') <= 1) {
    out.push({ id: 'support', priority: 0, title: 'Please look after yourself first', text: 'Today looks very hard. You do not have to do anything else. If you can, tell someone you trust, and remember the Help button shows people you can reach right now, including by text.', actions: [link('Get help now', 'help')] });
  }
  const b = burnoutSignals(entries);
  if (b.flag) {
    out.push({ id: 'burnout', priority: 1, title: 'This looks like the early shape of burnout', text: 'Several areas have been low or slipping together. Burnout comes from too many demands for too long. It is not laziness. Lowering demands early matters more than pushing through: cancel or shrink what you can, protect rest and food, cut sensory load, and give your attention somewhere safe to land. If skills you normally have are slipping, that is a signal to slow down, not to try harder.', actions: [link('Read: recovering from burnout', 'learn:burnoutrecovery'), link('Read: burnout', 'learn:burnout')] });
  }
  const trend = direction(entries, 'mood');
  if (trend.enough && trend.dir === 'down') out.push({ id: 'dip', priority: 2, title: 'Your overall score has been dipping', text: `Your last three check-ins average ${Math.abs(trend.delta)} lower than the three before. Small dips add up, so this is a good moment to lower demands a little earlier than usual and to protect one thing on purpose.`, actions: [link('Energy check-in', 'tool:checkin')] });
  if (trend.enough && trend.dir === 'up') out.push({ id: 'rise', priority: 6, title: 'Things have been improving', text: `Your last three check-ins average ${trend.delta} higher than the three before. Worth noticing what changed, so you can protect it: what did you do, drop, or get help with?`, actions: [] });

  const lows = DOMAINS.map((d) => ({ d, a: avgRecent(d.id), now: val(last, d.id) })).filter((x) => x.now <= 2 || x.a <= 2.4).sort((x, y) => x.a - y.a);
  for (const { d } of lows.slice(0, 2)) out.push({ id: `low-${d.id}`, priority: 3, domain: d.id, ...DOMAIN_ADVICE[d.id] });

  // energy: several loads together
  const sens = val(last, 'sensory'), exec = val(last, 'executive'), emo = val(last, 'emotional');
  if (sens <= 2 && exec <= 3 && !lows.some((x) => x.d.id === 'sensory' && lows.indexOf(x) < 2)) { /* covered above */ }
  if (sens <= 2 && emo <= 2) out.push({ id: 'sensory-emotion', priority: 4, title: 'Sensory load and mood may be feeding each other', text: 'When the senses are overloaded, feelings get harder to manage, and the other way round. Lower the input first (quiet, dim, softer), then see how you feel. It is easier to settle a calm body than a flooded one.', actions: [link('Sensory reset', 'tool:sensory')] });
  if (exec <= 2 && emo >= 3) out.push({ id: 'capacity', priority: 4, title: 'You may be running low on energy, not motivation', text: 'Your mood is holding up but daily tasks feel unmanageable, which often means energy is spent rather than that you do not care. Try energy accounting: list what each thing costs and what refills you, and put recovery next to the costly things.', actions: [link('Read: energy accounting', 'learn:energyaccounting')] });

  const link2 = strongestLink(entries);
  if (link2) out.push({ id: 'pattern', priority: 5, title: 'A pattern in your check-ins', text: `On days when ${link2.a.short.toLowerCase()} is lower, ${link2.b.short.toLowerCase()} tends to be ${link2.r > 0 ? 'lower' : 'higher'} too (a link of ${link2.r} across ${link2.n} days). This is a pattern, not proof, but it hints at where protecting your energy pays off most.`, actions: [] });

  if (!out.some((o) => o.priority <= 4)) {
    const best = [...DOMAINS].sort((x, y) => avgRecent(y.id) - avgRecent(x.id))[0];
    out.push({ id: 'steady', priority: 5, title: 'Things look steady', text: `${best.short} has been your strongest area lately. When things are steadier, it is a good time to protect what is working: keep your routines gentle, leave gaps in your day, and do one thing that is only for you.`, actions: [] });
  }
  return out.sort((a, b) => a.priority - b.priority);
}

/** What to offer as "one thing I'll protect today", biased to the lowest domain. */
export function protectSuggestions(entry) {
  const low = [...entry.domains].sort((a, b) => a.rating - b.rating)[0];
  const pool = low && low.rating <= 3 ? PROTECT_IDEAS[low.id] : PROTECT_IDEAS.general;
  return [...pool, ...PROTECT_IDEAS.general].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
}

// ---------------------------------------------------------------- text for the AI, exports and reminders
/** A compact summary the AI can use. Numbers only plus the person's own short notes, never instructions. */
export function summaryForAI(entries, now = new Date()) {
  const pd = perDay(entries);
  if (!pd.length) return '';
  const last = pd[pd.length - 1];
  const w = changes(entries, 7, now), a7 = w.current;
  const fmt = (e) => `${dayKey(e.createdAt)}: overall ${e.overallMood}/5; ` + e.domains.map((d) => `${DOMAINS.find((x) => x.id === d.id)?.short || d.id} ${d.rating}`).join(', ');
  const notes = pd.slice(-5).flatMap((e) => e.domains.filter((d) => d.note).map((d) => `${dayKey(e.createdAt)} ${DOMAINS.find((x) => x.id === d.id)?.short}: "${d.note.slice(0, 120)}"`)).slice(-5);
  const lines = [
    `Check-ins so far: ${pd.length}. Current streak: ${streak(entries, now)} days. Checked in today: ${checkedInToday(entries, now) ? 'yes' : 'no'}.`,
    `Latest (${fmt(last)})`,
    `7-day averages: overall ${a7.mood ?? 'n/a'}, ` + DOMAINS.map((d) => `${d.short} ${a7[d.id] ?? 'n/a'}`).join(', ') + '.',
    `Change vs the previous 7 days: ` + MEASURES.map((m) => (w.change[m.id] == null ? null : `${m.short} ${w.change[m.id] > 0 ? '+' : ''}${w.change[m.id]}`)).filter(Boolean).join(', ') + '.',
  ];
  const b = burnoutSignals(entries); if (b.flag) lines.push('Early burnout signals: several of sensory, daily living and emotional are low or slipping together.');
  if (last.protect) lines.push(`What they said they would protect today: "${last.protect.slice(0, 120)}".`);
  if (notes.length) lines.push('Their own recent notes:\n' + notes.join('\n'));
  return lines.join('\n');
}

/** True when the message is asking about their check-ins or how they have been doing. */
export const checkinIntent = (t) => /\b(check[- ]?ins?|how (have|am) i been|how i('| a)?m doing|my (week|wellbeing|wellness|trend|progress|scores?))\b|reflect on my|look back at my/i.test(t || '');

/** Built-in answer (no AI) about their check-ins: what the numbers say and one or two next steps. */
export function chatReply(entries, name = '', now = new Date()) {
  const pd = perDay(entries);
  const hi = name ? `${name}. ` : '';
  if (!pd.length) return { text: `${hi}You have not done a check-in yet. It takes about two minutes: one rating for how you are overall, then a quick look at six areas (senses, daily living, connection, emotions, sense of self and strengths). After a few days I can show you how things change and what might help.`, actions: [link('Do my first check-in', 'checkin')] };
  const a7 = changes(entries, 7, now), last = pd[pd.length - 1];
  const cap = RATING_CAPTIONS[Math.round(a7.current.mood ?? last.overallMood) - 1] || '';
  const lines = [`${hi}Over the last week your overall average is ${a7.current.mood}/5 (“${cap.toLowerCase()}”)${a7.change.mood != null ? `, ${a7.change.mood > 0 ? 'up' : a7.change.mood < 0 ? 'down' : 'the same'}${a7.change.mood ? ` ${Math.abs(a7.change.mood)}` : ''} on the week before` : ''}.`];
  const dom = DOMAINS.filter((d) => a7.current[d.id] != null).sort((x, y) => a7.current[x.id] - a7.current[y.id]);
  if (dom.length > 1) lines.push(`Lowest area: ${dom[0].short.toLowerCase()} (${a7.current[dom[0].id]}). Strongest: ${dom[dom.length - 1].short.toLowerCase()} (${a7.current[dom[dom.length - 1].id]}).`);
  const adv = advice(entries, now).slice(0, 2);
  for (const x of adv) lines.push(`**${x.title}.** ${x.text}`);
  const actions = [link(checkedInToday(entries, now) ? 'See my insights' : 'Check in today', checkedInToday(entries, now) ? 'checkin:insights' : 'checkin'), ...adv.flatMap((x) => x.actions).slice(0, 2)];
  return { text: lines.join('\n\n'), actions };
}

/** A plain-text summary a person can copy or share with a practitioner, in their own hands. */
export function shareableSummary(entries, days = 30, now = new Date()) {
  const list = inRange(entries, days, now);
  if (!list.length) return 'No check-ins in this period.';
  const av = averages(list), ch = changes(entries, days, now).change;
  const head = `6PF-Wellness check-ins${days ? `, last ${days} days` : ', all time'} (${list.length} check-ins, ${dayKey(list[0].createdAt)} to ${dayKey(list[list.length - 1].createdAt)})`;
  const rows = MEASURES.map((m) => `${m.label}: average ${av[m.id]}/5${ch[m.id] != null ? ` (${ch[m.id] > 0 ? '+' : ''}${ch[m.id]} vs the previous period)` : ''}`);
  const notes = list.flatMap((e) => [...(e.urgentNote ? [`${dayKey(e.createdAt)} note: ${e.urgentNote}`] : []), ...e.domains.filter((d) => d.note).map((d) => `${dayKey(e.createdAt)} ${DOMAINS.find((x) => x.id === d.id)?.short}: ${d.note}`)]);
  return [head, '', ...rows, notes.length ? '\nNotes\n' + notes.join('\n') : '', '\nScale: 1 Really struggling, 2 Finding it tough, 3 Managing okay, 4 Doing well, 5 Thriving.'].join('\n');
}
export function toCSV(entries) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const head = ['date', 'overall', ...DOMAINS.map((d) => d.id), ...DOMAINS.map((d) => `${d.id}_note`), 'note', 'protect'];
  const rows = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).map((e) => [e.createdAt, e.overallMood, ...DOMAINS.map((d) => val(e, d.id)), ...DOMAINS.map((d) => q(e.domains.find((x) => x.id === d.id)?.note)), q(e.urgentNote), q(e.protect)].join(','));
  return [head.join(','), ...rows].join('\n');
}

const REMINDERS = [
  ['Two minutes for you', 'How are you doing today? A quick check-in helps you spot what is draining you and protect what helps.'],
  ['Check in with your battery', 'Notice your energy before it runs out. Two minutes, and nothing to prepare.'],
  ['How is your body today?', 'Senses, energy, mood: a quick look. Small things you notice now can save you a crash later.'],
  ['Protect one thing today', 'Your check-in takes two minutes, and you can pick one thing to protect for yourself.'],
  ['A gentle nudge from Phoenix', 'No pressure. If you have the energy, a check-in shows how your week is going and what might help.'],
  ['Your wellbeing counts', 'You look after everyone else’s needs. Take two minutes to look at yours.'],
];
export function reminderMessage(seed = 0) { const [title, body] = REMINDERS[Math.abs(seed) % REMINDERS.length]; return { title, body }; }

/** A daily repeating calendar event with an alarm, for any device. */
export function dailyIcs(time = '10:00', url = '') {
  const [h, m] = time.split(':');
  const now = new Date(), stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}00Z`;
  const startDay = dayKey(now).replace(/-/g, '');
  const esc = (s) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NeuroHub Community//Phoenix//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:phoenix-daily-checkin@neurohubcommunity.org`, `DTSTAMP:${stamp}`, `DTSTART:${startDay}T${h}${m}00`, 'DURATION:PT5M',
    'RRULE:FREQ=DAILY', `SUMMARY:${esc('Phoenix check-in')}`,
    `DESCRIPTION:${esc('Two minutes to notice how you are today and protect one thing for yourself.' + (url ? '\n' + url : ''))}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Phoenix check-in', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
