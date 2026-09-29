// Small, dependency-free SVG charts for the check-in insights. Every chart has a text description and the screen also
// offers the same numbers as a table, so nothing depends on colour or sight alone (each line has its own dash pattern).
import { MEASURES, DOMAINS, RATING_CAPTIONS, val, dayKey, daysBetween } from './sixpf.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) n.setAttribute(k, v);
  for (const k of kids.flat()) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
};
const short = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Line chart of 1 to 5 ratings over time. `list` is one entry per day, oldest first; `show` is a list of measure ids. */
export function lineChart(list, show, { height = 240 } = {}) {
  const W = 640, H = height, L = 34, R = 12, T = 12, B = 30;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  if (!list.length) return svg;
  const t0 = new Date(list[0].createdAt), span = Math.max(1, daysBetween(t0, list[list.length - 1].createdAt));
  const x = (e) => L + (list.length === 1 ? (W - L - R) / 2 : (daysBetween(t0, e.createdAt) / span) * (W - L - R));
  const y = (v) => T + (1 - (v - 1) / 4) * (H - T - B);
  for (let v = 1; v <= 5; v++) {
    svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }), s('text', { x: L - 8, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, v));
  }
  const ticks = list.length > 1 ? [list[0], list[Math.floor((list.length - 1) / 2)], list[list.length - 1]] : [list[0]];
  for (const e of ticks) svg.append(s('text', { x: x(e), y: H - 8, class: 'axis', 'text-anchor': ticks.length === 1 ? 'middle' : e === ticks[0] ? 'start' : e === ticks[ticks.length - 1] ? 'end' : 'middle' }, short(e.createdAt)));
  const chosen = MEASURES.filter((m) => show.includes(m.id));
  for (const m of chosen) {
    const pts = list.map((e) => [x(e), y(val(e, m.id)), e]).filter(([, yy]) => Number.isFinite(yy));
    const strong = m.id === 'mood';
    if (pts.length > 1) svg.append(s('polyline', { points: pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '), class: 'series' + (strong ? ' strong' : ''), stroke: m.color, 'stroke-dasharray': m.dash || null, fill: 'none' }));
    for (const [px, py, e] of pts) svg.append(s('circle', { cx: px, cy: py, r: strong ? 4 : 3, fill: m.color, class: 'pt' }, s('title', {}, `${short(e.createdAt)}: ${m.label} ${val(e, m.id)}/5 (${RATING_CAPTIONS[val(e, m.id) - 1]})`)));
  }
  const first = list[0], last = list[list.length - 1];
  svg.setAttribute('aria-label', `Line chart of ${chosen.map((m) => m.short).join(', ')} from ${short(first.createdAt)} to ${short(last.createdAt)}, ${list.length} check-in${list.length === 1 ? '' : 's'}. Overall went from ${first.overallMood} to ${last.overallMood} out of 5. The same numbers are in the table below.`);
  return svg;
}

/** Line chart of the 1 to 10 ratings saved from the 6PF self-assessment. `series` is [{at, ratings: {domainId: 1-10}}], oldest first. */
export function assessmentChart(series, show, { height = 240 } = {}) {
  const W = 640, H = height, L = 34, R = 14, T = 12, B = 30, MAX = 10;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  if (!series.length) return svg;
  const t0 = new Date(series[0].at), span = Math.max(1, daysBetween(t0, series[series.length - 1].at));
  const x = (p) => L + (series.length === 1 ? (W - L - R) / 2 : (daysBetween(t0, p.at) / span) * (W - L - R));
  const y = (v) => T + (1 - (v - 1) / (MAX - 1)) * (H - T - B);
  for (const v of [1, 4, 7, 10]) svg.append(s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }), s('text', { x: L - 8, y: y(v) + 4, class: 'axis', 'text-anchor': 'end' }, v));
  const ticks = series.length > 1 ? [series[0], series[series.length - 1]] : [series[0]];
  ticks.forEach((p, i) => svg.append(s('text', { x: x(p), y: H - 8, class: 'axis', 'text-anchor': ticks.length === 1 ? 'middle' : i === 0 ? 'start' : 'end' }, short(p.at))));
  const chosen = DOMAINS.filter((d) => show.includes(d.id));
  for (const d of chosen) {
    const pts = series.map((p) => [x(p), p.ratings[d.id] != null ? y(p.ratings[d.id]) : NaN, p]).filter(([, yy]) => Number.isFinite(yy));
    if (pts.length > 1) svg.append(s('polyline', { points: pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' '), class: 'series', stroke: d.color, 'stroke-dasharray': d.dash || null, fill: 'none' }));
    for (const [px, py, p] of pts) svg.append(s('circle', { cx: px, cy: py, r: 4, fill: d.color, class: 'pt' }, s('title', {}, `${short(p.at)}: ${d.label} ${p.ratings[d.id]}/10`)));
  }
  svg.setAttribute('aria-label', `Line chart of ${chosen.map((d) => d.short).join(', ')} from ${short(series[0].at)} to ${short(series[series.length - 1].at)}, ${series.length} saved self-assessment${series.length === 1 ? '' : 's'}, each rated 1 to 10. The same numbers are in the table.`);
  return svg;
}

/** Bars: value 1 to 5 per label (weekday averages, domain averages). Items: [{label, value|null, color}]. */
export function barChart(items, { height = 170, label = 'Bar chart' } = {}) {
  const W = 640, H = height, L = 8, R = 8, T = 10, B = 30, gap = 10;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', preserveAspectRatio: 'xMidYMid meet' });
  const bw = (W - L - R - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const bx = L + i * (bw + gap), h = it.value == null ? 0 : ((it.value - 0) / 5) * (H - T - B);
    svg.append(s('rect', { x: bx, y: H - B - h, width: bw, height: Math.max(h, it.value == null ? 0 : 2), rx: 4, fill: it.color || 'currentColor', class: 'bar' }, s('title', {}, `${it.label}: ${it.value == null ? 'no data' : it.value + ' out of 5'}`)));
    svg.append(s('text', { x: bx + bw / 2, y: H - 10, class: 'axis', 'text-anchor': 'middle' }, it.label));
    if (it.value != null) svg.append(s('text', { x: bx + bw / 2, y: H - B - h - 4, class: 'axis strongtext', 'text-anchor': 'middle' }, it.value));
  });
  svg.setAttribute('aria-label', `${label}: ` + items.map((it) => `${it.label} ${it.value == null ? 'no data' : it.value}`).join(', ') + '. Scale 1 to 5.');
  return svg;
}

const heat = ['#ffffff00', '#5b3fa0', '#8c6fd1', '#b9a4e8', '#d6c9f5', '#efe8fc'];
/** Calendar heat map for the last `weeks` weeks (Monday first). Colour AND the number are shown in each cell. */
export function heatmap(entries, weeks = 12, now = new Date()) {
  const byDay = new Map(entries.map((e) => [dayKey(e.createdAt), e.overallMood]));
  const cell = 34, gap = 4, W = weeks * (cell + gap) + 30, H = 7 * (cell + gap) + 6;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart heat', role: 'img', preserveAspectRatio: 'xMinYMin meet' });
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const mondayOfThisWeek = new Date(today); mondayOfThisWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((d, r) => svg.append(s('text', { x: 8, y: r * (cell + gap) + cell / 2 + 4, class: 'axis' }, d)));
  let count = 0;
  for (let w = 0; w < weeks; w++) {
    for (let r = 0; r < 7; r++) {
      const d = new Date(mondayOfThisWeek); d.setDate(d.getDate() - (weeks - 1 - w) * 7 + r);
      if (d > today) continue;
      const k = dayKey(d), v = byDay.get(k), cx = 26 + w * (cell + gap), cy = r * (cell + gap);
      if (v) count++;
      svg.append(s('rect', { x: cx, y: cy, width: cell, height: cell, rx: 6, class: 'cell' + (v ? '' : ' empty'), fill: v ? DOMAINS_TONE[v] : 'none' }, s('title', {}, `${short(d)}: ${v ? `overall ${v}/5, ${RATING_CAPTIONS[v - 1].toLowerCase()}` : 'no check-in'}`)));
      if (v) svg.append(s('text', { x: cx + cell / 2, y: cy + cell / 2 + 5, class: 'cellnum', 'text-anchor': 'middle', fill: v <= 2 ? '#ffffff' : '#16121f' }, v));
    }
  }
  svg.setAttribute('aria-label', `Calendar of the last ${weeks} weeks. ${count} days have a check-in. Each day shows the overall score from 1 to 5.`);
  return svg;
}
// dark = lower scores, light = higher (numbers are printed in each cell as well).
const DOMAINS_TONE = { 1: heat[1], 2: heat[2], 3: heat[3], 4: heat[4], 5: heat[5] };
