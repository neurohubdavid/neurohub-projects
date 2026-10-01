// The daily 6PF-Wellness check-in: a short guided flow, results with advice, and insights over time.
// Everything is stored on this device (state.wellness) in the same shape as the NeuroHub client portal.
import { el, toast, announce, modal, copyText, download, fmtDate, fmtTime, uid } from './util.js';
import { state, save, aiMaySeeCheckins } from './store.js';
import { CRISIS_RE, openHelp } from './crisis.js';
import { prefillChat } from './chat.js';
import { lineChart, barChart, heatmap } from './charts.js';
import { nudgeAfterCheckin } from './reminders.js';
import * as S from './sixpf.js';
import { shareCheckin } from './share.js';
import * as R from './reports.js';
import { mountReports, leaveReports } from './reports-ui.js';
import { assessmentChart } from './charts.js';

const RANGES = [[7, '7 days'], [30, '30 days'], [90, '90 days'], [0, 'All time']];
let cleanup = null;
export const leaveCheckin = () => { try { cleanup?.(); } catch { /* ignore */ } cleanup = null; };

export function mountCheckin(container, { navigate, sub = '' }) {
  leaveCheckin();
  container.textContent = '';
  container.classList.remove('chat-view');
  const body = el('div', { class: 'stack' });
  const tab = (id, label) => el('button', { 'aria-pressed': String(sub === id), onclick: () => navigate(id ? 'checkin:' + id : 'checkin') }, label);
  const isDoc = sub === 'reports' || sub.startsWith('doc-');
  const tabs = el('div', { class: 'seg', role: 'group', 'aria-label': 'Check-in sections' }, tab('', 'Today'), tab('insights', 'Insights'), tab('reports', 'Documents'), tab('history', 'History'));
  if (isDoc) { const b = [...tabs.children].find((x) => x.textContent === 'Documents'); b?.setAttribute('aria-pressed', 'true'); }
  container.append(el('div', { class: 'view-title' }, el('span', { 'aria-hidden': 'true', style: { fontSize: '2rem' } }, isDoc ? '📄' : '🌅'), el('h1', {}, isDoc ? 'Documents' : 'Daily check-in')), tabs, body);
  if (isDoc) { mountReports(body, { navigate, id: sub.startsWith('doc-') ? sub.slice(4) : '' }); cleanup = leaveReports; return; }
  if (sub === 'new') { tabs.remove(); return flow(body, navigate); }
  if (sub === 'insights') return insights(body, navigate);
  if (sub === 'history') return history(body, navigate);
  return home(body, navigate);
}

// ---------------------------------------------------------------- shared bits
const adviceCard = (a, navigate) => el('section', { class: 'card advice-card', 'aria-labelledby': 'adv-' + a.id },
  el('h3', { id: 'adv-' + a.id }, a.title), el('p', {}, a.text),
  a.actions?.length ? el('div', { class: 'row-wrap' }, a.actions.map((x) => el('button', { class: 'btn btn-sm', onclick: () => navigate(x.go) }, x.label))) : null);

const talkButton = (navigate, text) => el('button', { class: 'btn btn-purple', onclick: () => { navigate('chat'); prefillChat(text); } }, 'Talk it through with Phoenix');

function privacyNote() {
  return el('p', { class: 'muted small' }, 'Your check-ins stay on this device. ' + (aiMaySeeCheckins() ? 'The AI you connected can read a short summary of them to help you, and you can change that in Settings.' : 'The AI you use cannot see them unless you allow it in Settings.'));
}

// ---------------------------------------------------------------- today
function home(body, navigate) {
  const list = state.wellness, done = S.checkedInToday(list), pd = S.perDay(list), last = pd[pd.length - 1];
  const n = S.streak(list);
  body.append(el('p', { class: 'muted' }, 'Two minutes to notice how you are, across six areas. There are no wrong answers, and skipping a day is fine. Small check-ins add up to a picture of what drains you and what helps.'));
  const status = el('section', { class: 'card', 'aria-labelledby': 'ck-h' },
    el('h2', { id: 'ck-h' }, done ? 'You have checked in today' : list.length ? 'How are you today?' : 'Start your first check-in'),
    done && last ? el('p', {}, `${S.MOOD_EMOJI[last.overallMood - 1]} Overall: ${S.RATING_CAPTIONS[last.overallMood - 1].toLowerCase()} (${last.overallMood}/5), at ${fmtTime(last.createdAt)}.`) : el('p', { class: 'muted' }, 'It takes about two minutes and nothing has to be perfect.'),
    n ? el('p', { class: 'chip' }, `🔥 ${n}-day streak`) : null,
    el('div', { class: 'row-wrap' },
      el('button', { class: 'btn btn-lg ' + (done ? '' : 'btn-primary'), onclick: () => navigate('checkin:new') }, done ? 'Check in again' : 'Start check-in'),
      list.length ? el('button', { class: 'btn btn-lg', onclick: () => navigate('checkin:insights') }, 'See my insights') : null));
  body.append(status);
  if (list.length) {
    const adv = S.advice(list);
    body.append(el('h2', {}, 'Ideas for right now'), ...adv.slice(0, 3).map((a) => adviceCard(a, navigate)), talkButton(navigate, 'How have I been doing this week?'));
  } else {
    body.append(el('div', { class: 'card' }, el('h3', {}, 'What you will be asked'), el('ul', {}, S.DOMAINS.map((d) => el('li', {}, el('strong', {}, d.label + '. '), d.prompt)))));
  }
  body.append(el('section', { class: 'card', 'aria-labelledby': 'dc-h' }, el('h3', { id: 'dc-h' }, 'Fill in a NeuroHub document, and download it as a PDF'),
    el('p', { class: 'muted small' }, 'The 6PF Global Assessment, a burnout recovery plan and a positive identity workbook. Phoenix can draft answers from what you have told it, you check them, and the ratings appear in your Insights.'),
    el('button', { class: 'btn btn-sm', onclick: () => navigate('checkin:reports') }, 'Open documents')));
  body.append(reminderCard(navigate), privacyNote());
}

function reminderCard(navigate) {
  const r = state.reminders;
  return el('section', { class: 'card', 'aria-labelledby': 'rm-h' },
    el('h3', { id: 'rm-h' }, r.enabled ? `Daily reminder is on (${r.time})` : 'Want a gentle daily reminder?'),
    el('p', { class: 'muted small' }, 'A short notification once a day, at a time you choose. You can turn it off any time, and it never nags.'),
    el('button', { class: 'btn btn-sm', onclick: () => navigate('settings:reminders') }, r.enabled ? 'Change reminder' : 'Set a reminder'));
}

// ---------------------------------------------------------------- the check-in flow
function flow(body, navigate) {
  const draft = S.freshEntry();
  const touched = new Set();
  let step = 0; // 0 overall, 1..6 domains, 7 note and protect
  const total = 8;
  const container = el('div', { class: 'stack' });
  body.append(container);

  const progress = () => el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(total - 1), 'aria-valuenow': String(step), 'aria-label': `Step ${step + 1} of ${total}` },
    el('span', { style: { width: `${((step + 1) / total) * 100}%` } }));

  function ratingGroup(name, value, onPick) {
    const wrap = el('div', { class: 'ratings', role: 'radiogroup', 'aria-label': 'Rating from 1 to 5' });
    for (let i = 1; i <= 5; i++) {
      const id = `${name}-${i}`;
      const input = el('input', { type: 'radio', name, id, value: String(i), checked: value === i && touched.has(name) ? true : null });
      input.addEventListener('change', () => onPick(i));
      wrap.append(el('div', { class: 'rate' }, input, el('label', { for: id }, el('span', { class: 'big', 'aria-hidden': 'true' }, name === 'mood' ? S.MOOD_EMOJI[i - 1] : String(i)), el('span', { class: 'cap' }, S.RATING_CAPTIONS[i - 1]))));
    }
    return wrap;
  }

  function nav(next, { skip = true } = {}) {
    return el('div', { class: 'row-wrap' },
      step > 0 ? el('button', { class: 'btn', onclick: () => { step--; draw(); } }, 'Back') : el('button', { class: 'btn btn-ghost', onclick: () => navigate('checkin') }, 'Not now'),
      el('button', { class: 'btn btn-primary', onclick: next }, step === total - 1 ? 'Save check-in' : 'Next'),
      skip && step > 0 && step < total - 1 ? el('button', { class: 'btn btn-ghost', onclick: () => { step++; draw(); } }, 'Skip this one') : null);
  }

  function draw() {
    container.textContent = '';
    container.append(progress());
    let heading;
    if (step === 0) {
      container.append(el('h2', { id: 'step-h', tabindex: '-1' }, 'How are you doing overall today?'), el('p', { class: 'muted' }, 'Pick the one that is closest. Rough is fine.'),
        ratingGroup('mood', draft.overallMood, (i) => { draft.overallMood = i; touched.add('mood'); }), nav(() => { step++; draw(); }, { skip: false }));
    } else if (step <= S.DOMAINS.length) {
      const d = S.DOMAINS[step - 1], entry = draft.domains[step - 1];
      container.append(el('p', { class: 'chip', style: { borderColor: d.color } }, `${step} of ${S.DOMAINS.length}`),
        el('h2', { id: 'step-h', tabindex: '-1' }, d.label), el('p', {}, d.prompt),
        ratingGroup('d-' + d.id, entry.rating, (i) => { entry.rating = i; touched.add('d-' + d.id); }),
        el('label', { class: 'field' }, el('span', { class: 'hint' }, 'Optional note, just for you'),
          el('textarea', { class: 'input', rows: '3', maxlength: '500', placeholder: d.notePlaceholder, 'aria-label': `Note about ${d.label}`, value: entry.note, oninput: (e) => { entry.note = e.target.value; } })),
        nav(() => { step++; draw(); }));
    } else {
      const sugg = S.protectSuggestions(draft);
      const protectIn = el('input', { class: 'input', maxlength: '120', placeholder: 'For example: ten quiet minutes after lunch', 'aria-label': 'One thing I will protect today', value: draft.protect, oninput: (e) => { draft.protect = e.target.value; } });
      container.append(el('h2', { id: 'step-h', tabindex: '-1' }, 'Anything else, and one thing to protect'),
        el('label', { class: 'field' }, el('span', { class: 'hint' }, 'Anything on your mind today? Optional.'),
          el('textarea', { class: 'input', rows: '3', maxlength: '800', 'aria-label': 'Anything on your mind', value: draft.urgentNote, oninput: (e) => { draft.urgentNote = e.target.value; } })),
        el('p', { class: 'muted small' }, 'Phoenix cannot alert anyone. If you are in danger or thinking about ending your life, use the red Help button at the top now.'),
        el('label', { class: 'field' }, el('span', { class: 'hint' }, 'Looking after yourself: what is one thing you want to protect today? Pick one or write your own.'), protectIn),
        el('div', { class: 'chips' }, sugg.map((t) => el('button', { class: 'chip-btn', onclick: () => { draft.protect = t; protectIn.value = t; protectIn.focus(); } }, t))),
        nav(save1));
    }
    const h = container.querySelector('#step-h');
    if (h) { h.focus({ preventScroll: false }); announce(h.textContent); }
    heading = h;
    void heading;
  }

  function save1() {
    const now = new Date();
    const entry = { ...draft, id: uid(), createdAt: now.toISOString() };
    state.wellness.push(entry);
    state.wellness = state.wellness.slice(-1500);
    save();
    nudgeAfterCheckin();
    shareCheckin(entry); // does nothing unless the person has chosen to share their scores
    results(entry);
  }

  function results(entry) {
    container.textContent = '';
    const risky = entry.overallMood === 1 || CRISIS_RE.test(entry.urgentNote || '') || CRISIS_RE.test(entry.domains.map((d) => d.note).join(' '));
    container.append(el('h2', { id: 'step-h', tabindex: '-1' }, `${S.MOOD_EMOJI[entry.overallMood - 1]} Saved. Thank you for checking in.`));
    if (risky) container.append(el('div', { class: 'card notice-help', role: 'alert' }, el('p', {}, el('strong', {}, 'Today sounds really hard. '), 'You do not have to carry it alone. The Help button shows people you can reach right now, including by text.'), el('button', { class: 'btn btn-danger', onclick: () => openHelp() }, 'Get help now')));
    if (entry.protect) container.append(el('div', { class: 'card' }, el('p', { class: 'muted small' }, 'Protecting today'), el('p', {}, el('strong', {}, entry.protect)), el('p', { class: 'muted small' }, 'Give it a real time in your day, and treat it as fixed, like an appointment with yourself.')));
    const adv = S.advice(state.wellness);
    container.append(el('h3', {}, 'Ideas based on your check-ins'), ...adv.slice(0, 3).map((a) => adviceCard(a, navigate)));
    const lowest = [...entry.domains].sort((a, b) => a.rating - b.rating)[0];
    const dLabel = S.DOMAINS.find((d) => d.id === lowest.id)?.short.toLowerCase();
    // A single, gentle, one-time question after a few check-ins: never a pop-up, and never asked again once answered.
    state.share ||= { on: false, pid: '', since: '', pending: [], asked: false };
    if (!state.share.on && !state.share.asked && state.wellness.length >= 3 && !risky) {
      container.append(el('section', { class: 'card', 'aria-labelledby': 'sh-h' },
        el('h3', { id: 'sh-h' }, 'Help NeuroHub understand what helps? (optional)'),
        el('p', { class: 'muted small' }, 'If you are 16 or over, you can choose to share just your check-in scores, anonymously, so NeuroHub can see how people are doing over time. No name, no notes, and you can stop and delete it any time.'),
        el('div', { class: 'row-wrap' },
          el('button', { class: 'btn btn-sm', onclick: () => { state.share.asked = true; save(); navigate('settings:share'); } }, 'Tell me more'),
          el('button', { class: 'btn btn-sm btn-ghost', onclick: (e) => { state.share.asked = true; save(); e.target.closest('section').remove(); } }, 'No thanks'))));
    }
    container.append(el('div', { class: 'row-wrap' }, talkButton(navigate, `I just did my check-in. ${dLabel} was the hardest (${lowest.rating}/5). Can we talk about it?`), el('button', { class: 'btn', onclick: () => navigate('checkin:insights') }, 'See my insights'), el('button', { class: 'btn btn-ghost', onclick: () => navigate('checkin') }, 'Done')));
    announce('Check-in saved');
    container.querySelector('#step-h')?.focus();
  }

  draw();
}

// ---------------------------------------------------------------- saved documents in Insights
function assessmentInsights(navigate) {
  const series = R.ratingSeries(state.reports);
  const tl = R.timeline(state.reports);
  if (!series.length && !tl.length) {
    return el('section', { class: 'card', 'aria-labelledby': 'as-h' }, el('h2', { id: 'as-h' }, 'Deeper look: 6PF self-assessment'),
      el('p', { class: 'muted' }, 'Fill in the 6PF Global Assessment in Documents (Phoenix can draft it from your chats), rate each area from 1 to 10 and save it. Do it again every few weeks and the changes show up here.'),
      el('button', { class: 'btn', onclick: () => navigate('checkin:reports') }, 'Open documents'));
  }
  const box = el('section', { class: 'card', 'aria-labelledby': 'as-h' }, el('h2', { id: 'as-h' }, 'Your saved documents over time'));
  if (series.length) {
    const shown = new Set(S.DOMAINS.map((d) => d.id));
    const chartBox = el('div', { class: 'chart-box' });
    const toggles = el('fieldset', { class: 'toggles' }, el('legend', {}, 'Show on the chart'));
    for (const d of S.DOMAINS) {
      const cb = el('input', { type: 'checkbox', id: 'as-' + d.id, checked: true });
      cb.addEventListener('change', () => { cb.checked ? shown.add(d.id) : shown.delete(d.id); if (!shown.size) { shown.add(d.id); cb.checked = true; } drawC(); });
      toggles.append(el('label', { class: 'tg' }, cb, el('span', { class: 'swatch', 'aria-hidden': 'true', html: `<svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="${d.color}" stroke-width="3" ${d.dash ? `stroke-dasharray="${d.dash}"` : ''}/></svg>` }), d.short));
    }
    const drawC = () => { chartBox.textContent = ''; chartBox.append(assessmentChart(series, [...shown])); };
    drawC();
    box.append(el('h3', {}, '6PF Global Assessment ratings (1 to 10)'), chartBox, toggles);
    const ch = R.ratingChanges(series);
    box.append(el('div', { class: 'scroll-x' }, el('table', { class: 'data' },
      el('caption', { class: 'sr-only' }, 'First and latest self-assessment ratings'),
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Area'), el('th', { scope: 'col' }, series.length > 1 ? 'First' : 'Rating'), series.length > 1 ? el('th', { scope: 'col' }, 'Latest') : null, series.length > 1 ? el('th', { scope: 'col' }, 'Change') : null)),
      el('tbody', {}, ch.map((c) => el('tr', {}, el('th', { scope: 'row' }, c.domain.short), el('td', {}, series.length > 1 ? c.first ?? '–' : c.last), series.length > 1 ? el('td', {}, c.last) : null,
        series.length > 1 ? el('td', {}, c.delta == null ? '–' : c.delta > 0 ? `▲ ${c.delta}` : c.delta < 0 ? `▼ ${Math.abs(c.delta)}` : '＝') : null))))));
    if (series.length > 1) {
      const up = ch.filter((c) => c.delta > 0).sort((a, b) => b.delta - a.delta)[0], down = ch.filter((c) => c.delta < 0).sort((a, b) => a.delta - b.delta)[0];
      box.append(el('p', { class: 'muted' }, [up && `${up.domain.short} has moved most in the right direction (+${up.delta}).`, down && `${down.domain.short} has dipped the most (${down.delta}), so it may deserve some kindness and a lower demand.`].filter(Boolean).join(' ') || 'Your ratings are steady between your first and latest assessment.'));
    } else box.append(el('p', { class: 'muted' }, 'Save another self-assessment in a few weeks to see how things change.'));
  }
  if (tl.length) box.append(el('h3', {}, 'What you have saved'), el('ul', {}, tl.slice(0, 8).map((t) => { const d = R.getDoc(t.doc); return el('li', {}, `${fmtDate(t.at)}: ${d?.title || t.doc} (${t.answered} of ${t.total} questions answered${t.steps != null ? `, ${t.steps} of 6 areas have a small next step` : ''})`); })));
  box.append(el('button', { class: 'btn btn-sm', onclick: () => navigate('checkin:reports') }, 'Open documents'));
  return box;
}

// ---------------------------------------------------------------- insights
function insights(body, navigate) {
  const list = state.wellness;
  const aHost = el('div', {}); // the saved-documents section fills in once the document definitions have loaded
  R.loadDocs().catch(() => {}).then(() => aHost.replaceChildren(assessmentInsights(navigate)));
  if (!list.length) { body.append(el('div', { class: 'card' }, el('p', {}, 'Nothing to show yet. Do a check-in and your first chart will appear here. A picture starts to form after about a week.'), el('button', { class: 'btn btn-primary', onclick: () => navigate('checkin:new') }, 'Start check-in')), aHost); return; }
  let days = 30;
  let shown = new Set(['mood']);
  const out = el('div', { class: 'stack' });
  const rangeBar = el('div', { class: 'seg', role: 'group', 'aria-label': 'Time range' });
  body.append(rangeBar, out, aHost);

  const drawRange = () => { rangeBar.textContent = ''; for (const [d, l] of RANGES) rangeBar.append(el('button', { 'aria-pressed': String(d === days), onclick: () => { days = d; drawRange(); draw(); } }, l)); };

  function draw() {
    out.textContent = '';
    const cur = S.inRange(list, days), ch = S.changes(list, days);
    const arrow = (n) => (n == null ? '' : n > 0.05 ? `▲ ${n}` : n < -0.05 ? `▼ ${Math.abs(n)}` : '＝ no change');
    if (!cur.length) { out.append(el('p', { class: 'muted' }, 'No check-ins in this period. Try a longer range.')); return; }

    out.append(el('div', { class: 'kpis' },
      kpi('Check-ins', String(cur.length), days ? `in ${days} days` : 'in total'),
      kpi('Streak', `${S.streak(list)}`, `best ${S.longestStreak(list)}`),
      kpi('Overall average', `${ch.current.mood}/5`, arrow(ch.change.mood) || S.RATING_CAPTIONS[Math.round(ch.current.mood) - 1]),
      kpi('Lowest area', low(ch.current).short, `${low(ch.current).v}/5`)));

    if (cur.length < 3) out.append(el('p', { class: 'muted' }, 'Trends need a few more check-ins to mean anything. Here is what you have so far.'));

    // line chart with toggles
    const chartBox = el('div', { class: 'chart-box' });
    const toggles = el('fieldset', { class: 'toggles' }, el('legend', {}, 'Show on the chart'));
    for (const m of S.MEASURES) {
      const cb = el('input', { type: 'checkbox', id: 'sh-' + m.id, checked: shown.has(m.id) ? true : null });
      cb.addEventListener('change', () => { cb.checked ? shown.add(m.id) : shown.delete(m.id); if (!shown.size) { shown.add('mood'); cb.checked = m.id === 'mood'; } drawChart(); });
      toggles.append(el('label', { class: 'tg' }, cb, el('span', { class: 'swatch', 'aria-hidden': 'true', html: `<svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="${m.color}" stroke-width="3" ${m.dash ? `stroke-dasharray="${m.dash}"` : ''}/></svg>` }), m.short));
    }
    const drawChart = () => { chartBox.textContent = ''; chartBox.append(lineChart(cur, [...shown])); };
    drawChart();
    out.append(el('section', { class: 'card', 'aria-labelledby': 'ch1' }, el('h2', { id: 'ch1' }, 'Over time'), chartBox, toggles));

    // domain averages
    out.append(el('section', { class: 'card', 'aria-labelledby': 'ch2' }, el('h2', { id: 'ch2' }, 'Your six areas'),
      barChart(S.DOMAINS.map((d) => ({ label: d.short, value: ch.current[d.id], color: d.color })), { label: 'Average rating for each of the six areas' }),
      days ? el('ul', { class: 'changes' }, S.DOMAINS.map((d) => el('li', {}, el('strong', {}, d.short + ': '), ch.change[d.id] == null ? 'not enough earlier data to compare' : `${arrow(ch.change[d.id])} compared with the previous ${days} days`))) : null));

    // weekday + heatmap
    const wk = S.weekdayAverages(days ? S.inRange(list, days) : list);
    const enough = wk.filter((w) => w.n >= 2).length >= 4;
    if (enough) {
      const best = [...wk].filter((w) => w.avg != null).sort((a, b) => b.avg - a.avg), lowD = best[best.length - 1];
      out.append(el('section', { class: 'card', 'aria-labelledby': 'ch3' }, el('h2', { id: 'ch3' }, 'Which days feel easier?'),
        barChart(wk.map((w) => ({ label: w.label, value: w.avg, color: 'var(--accent)' })), { label: 'Average overall score by day of the week' }),
        el('p', { class: 'muted' }, `Your overall score tends to be highest on ${best[0].label} and lowest on ${lowD.label}. If that matches something in your week, it can show what to plan around.`)));
    }
    out.append(el('section', { class: 'card', 'aria-labelledby': 'ch4' }, el('h2', { id: 'ch4' }, 'Calendar'), el('div', { class: 'scroll-x' }, heatmap(S.perDay(list), 12)),
      el('p', { class: 'muted small' }, 'Each square is a day. Darker means a harder day. The number is the overall score, and empty squares are days without a check-in, which is fine.')));

    // advice + notes
    const adv = S.advice(list);
    out.append(el('h2', {}, 'What might help'), ...adv.map((a) => adviceCard(a, navigate)));
    out.append(talkButton(navigate, 'Can you look at my check-ins with me and help me work out what to protect this week?'));
    if (!aiMaySeeCheckins()) out.append(el('p', { class: 'muted small' }, 'The advice above is built into Phoenix and works offline. If you allow it in Settings, Phoenix AI can also read a short summary and discuss your patterns in conversation.'));

    const notes = cur.flatMap((e) => e.domains.filter((d) => d.note).map((d) => ({ at: e.createdAt, d }))).slice(-8).reverse();
    if (notes.length) out.append(el('section', { class: 'card', 'aria-labelledby': 'ch5' }, el('h2', { id: 'ch5' }, 'Your own notes'), el('ul', {}, notes.map((n) => el('li', {}, el('strong', {}, `${fmtDate(n.at, { day: 'numeric', month: 'short' })}, ${S.DOMAINS.find((x) => x.id === n.d.id)?.short}: `), n.d.note)))));

    // table alternative and export
    out.append(el('details', { class: 'card' }, el('summary', {}, 'See the numbers as a table'), tableOf(cur)));
    out.append(el('div', { class: 'row-wrap' },
      el('button', { class: 'btn', onclick: async () => toast((await copyText(S.shareableSummary(list, days))) ? 'Summary copied.' : 'Could not copy.') }, 'Copy a summary'),
      el('button', { class: 'btn', onclick: () => download(`phoenix-checkins-${new Date().toISOString().slice(0, 10)}.csv`, S.toCSV(list), 'text/csv') }, 'Download as spreadsheet (CSV)')));
    out.append(el('p', { class: 'muted small' }, 'These are patterns in your own words and numbers, not a diagnosis. A summary is yours to keep or to show someone you trust, such as a doctor or support worker.'));
  }
  const kpi = (label, value, note) => el('div', { class: 'kpi card' }, el('span', { class: 'muted small' }, label), el('strong', { class: 'kpi-v' }, value), el('span', { class: 'small' }, note));
  const low = (avgs) => { const d = [...S.DOMAINS].filter((x) => avgs[x.id] != null).sort((a, b) => avgs[a.id] - avgs[b.id])[0]; return d ? { short: d.short, v: avgs[d.id] } : { short: 'n/a', v: '' }; };
  const tableOf = (cur) => el('div', { class: 'scroll-x' }, el('table', { class: 'data' },
    el('caption', { class: 'sr-only' }, 'Check-in ratings by day'),
    el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Day'), el('th', { scope: 'col' }, 'Overall'), ...S.DOMAINS.map((d) => el('th', { scope: 'col' }, d.short)))),
    el('tbody', {}, [...cur].reverse().map((e) => el('tr', {}, el('th', { scope: 'row' }, fmtDate(e.createdAt, { day: 'numeric', month: 'short' })), el('td', {}, e.overallMood), ...S.DOMAINS.map((d) => el('td', {}, S.val(e, d.id) ?? '')))))));
  drawRange(); draw();
}

// ---------------------------------------------------------------- history
function history(body, navigate) {
  const list = [...state.wellness].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (!list.length) { body.append(el('p', { class: 'muted' }, 'No check-ins yet.')); return; }
  const ul = el('div', { class: 'stack' });
  const draw = () => {
    ul.textContent = '';
    const cur = [...state.wellness].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    for (const e of cur.slice(0, 200)) {
      ul.append(el('details', { class: 'card' },
        el('summary', {}, `${fmtDate(e.createdAt)} ${fmtTime(e.createdAt)}  ${S.MOOD_EMOJI[e.overallMood - 1]} overall ${e.overallMood}/5`),
        el('ul', {}, e.domains.map((d) => el('li', {}, el('strong', {}, `${S.DOMAINS.find((x) => x.id === d.id)?.short}: `), `${d.rating}/5 (${S.RATING_CAPTIONS[d.rating - 1].toLowerCase()})`, d.note ? ` — ${d.note}` : ''))),
        e.urgentNote ? el('p', {}, el('strong', {}, 'On my mind: '), e.urgentNote) : null,
        e.protect ? el('p', {}, el('strong', {}, 'Protecting: '), e.protect) : null,
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => confirmDelete(e) }, 'Delete this check-in')));
    }
  };
  const confirmDelete = (e) => modal({ title: 'Delete this check-in?', body: el('p', {}, 'This removes it from your history and insights. It cannot be undone.'), actions: [{ label: 'Keep it' }, { label: 'Delete', class: 'btn-danger', onclick: () => { state.wellness = state.wellness.filter((x) => x.id !== e.id); save(); draw(); toast('Deleted.'); } }] });
  body.append(el('p', { class: 'muted' }, `${list.length} check-in${list.length === 1 ? '' : 's'} stored on this device.`), ul);
  draw();
}
