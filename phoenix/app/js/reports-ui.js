// The "Documents" screens: pick a NeuroHub reflection document, fill it in (by hand, one section at a time, or with
// Phoenix drafting answers from what the person has told it), download it as a PDF, and save the ratings to Insights.
import { el, toast, announce, modal, download, fmtDate, esc } from './util.js';
import { trackFeature } from './analytics.js';
import { state, save, aiActive, aiMaySeeCheckins } from './store.js';
import { streamChat, providerConfig } from './providers.js';
import { summaryForAI, perDay } from './sixpf.js';
import { prefillChat } from './chat.js';
import { makePdf } from './pdf.js';
import * as R from './reports.js';

const findReport = (id) => state.reports.find((r) => r.id === id);
let aiAbort = null;
export const leaveReports = () => { aiAbort?.abort(); aiAbort = null; document.getElementById('print-root')?.remove(); };

export async function mountReports(body, { navigate, id = '' }) {
  try { await R.loadDocs(); } catch (e) { body.append(el('p', { class: 'muted' }, e.message)); return; }
  const report = id ? findReport(id) : null;
  if (id && !report) { body.append(el('p', {}, 'That document was not found.'), el('button', { class: 'btn', onclick: () => navigate('checkin:reports') }, 'Back to documents')); return; }
  if (report) return editor(body, { navigate, report });
  return list(body, { navigate });
}

// ---------------------------------------------------------------- the list
function list(body, { navigate }) {
  body.append(el('p', { class: 'muted' }, 'NeuroHub’s reflection documents, made for you to fill in yourself. Phoenix can draft answers from what you have already told it, you check and change them, and you can download the result as a PDF to keep or to show someone you trust. The ratings feed your Insights so you can see how things change.'));
  body.append(el('div', { class: 'grid docs-grid' }, R.getDocs().map((d) => el('section', { class: 'card doc-card', 'aria-labelledby': 'dc-' + d.id },
    el('span', { class: 'ico', 'aria-hidden': 'true' }, d.icon), el('h2', { id: 'dc-' + d.id }, d.title), el('p', { class: 'muted small' }, d.blurb),
    el('button', { class: 'btn btn-primary', onclick: () => { const r = R.newReport(d, { name: state.profile.name }); state.reports.push(r); trackFeature('doc_started'); save(); navigate('checkin:doc-' + r.id); } }, `Start ${d.short.toLowerCase()}`)))));
  const mine = [...state.reports].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!mine.length) return;
  body.append(el('h2', {}, 'Your documents'));
  const box = el('div', { class: 'stack' }); body.append(box);
  const draw = () => {
    box.textContent = '';
    for (const r of [...state.reports].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))) {
      const d = R.getDoc(r.doc); if (!d) continue;
      const p = R.progress(d, r);
      box.append(el('div', { class: 'card doc-row' },
        el('div', {}, el('strong', {}, `${d.icon} ${d.title}`), el('div', { class: 'muted small' }, `Updated ${fmtDate(r.updatedAt)} · ${p.pct}% filled in${r.snapshots.length ? ` · saved to Insights ${r.snapshots.length} time${r.snapshots.length === 1 ? '' : 's'}` : ''}`)),
        el('div', { class: 'row-wrap' },
          el('button', { class: 'btn btn-sm', onclick: () => navigate('checkin:doc-' + r.id) }, 'Open'),
          d.kind === 'rated' ? el('button', { class: 'btn btn-sm', title: 'Copy this one to fill in again and see what has changed', onclick: () => { const n = R.newReport(d, { from: r }); state.reports.push(n); save(); navigate('checkin:doc-' + n.id); } }, 'Do it again from this') : null,
          el('button', { class: 'btn btn-sm btn-ghost', onclick: () => modal({ title: 'Delete this document?', body: el('p', {}, 'The document and the ratings you saved from it to Insights will be deleted. This cannot be undone.'), actions: [{ label: 'Keep it' }, { label: 'Delete', class: 'btn-danger', onclick: () => { state.reports = state.reports.filter((x) => x.id !== r.id); save(); draw(); toast('Deleted.'); } }] }) }, 'Delete'))));
    }
  };
  draw();
}

// ---------------------------------------------------------------- the editor
function editor(body, { navigate, report }) {
  const doc = R.getDoc(report.doc);
  if (!doc) { body.append(el('p', {}, 'This document type is no longer available.')); return; }
  const sections = R.sectionsOf(doc);
  let cur = Math.min(Number(sessionStorageGet('phoenix.doc.' + report.id)) || 0, sections.length - 1);
  const progressEl = el('p', { class: 'muted', 'aria-live': 'polite' });
  const statusEl = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const secBox = el('div', { class: 'stack' });
  const nav = el('div', { class: 'row-wrap doc-nav', role: 'group', 'aria-label': 'Sections' });
  const persist = () => { R.touch(report); save(); drawProgress(); };
  const small = () => false; // Phoenix AI is always a capable Claude model

  function drawProgress() {
    const p = R.progress(doc, report);
    progressEl.textContent = `${p.done} of ${p.all} filled in (${p.pct}%). Nothing here is required, so leave anything you want to skip.`;
    [...nav.children].forEach((b, i) => { const sp = R.sectionProgress(sections[i], report); const done = sp.answered === sp.total && sp.rated !== false; b.textContent = `${i + 1}${done ? ' ✓' : ''}`; b.setAttribute('aria-label', `${sections[i].title}${done ? ', done' : ''}`); });
  }
  function drawNav() {
    nav.textContent = '';
    sections.forEach((s, i) => nav.append(el('button', { class: 'chip-btn', 'aria-current': i === cur ? 'step' : null, title: s.title, onclick: () => { cur = i; sessionStorageSet('phoenix.doc.' + report.id, i); drawSection(); drawNavState(); } }, String(i + 1))));
    drawProgress(); drawNavState();
  }
  const drawNavState = () => [...nav.children].forEach((b, i) => { if (i === cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });

  function drawSection() {
    const s = sections[cur];
    secBox.textContent = '';
    const card = el('section', { class: 'card', style: { borderLeft: `8px solid ${s.color}` }, 'aria-labelledby': 'sec-h' });
    card.append(el('h2', { id: 'sec-h', tabindex: '-1', style: { color: s.color === '#16121F' ? 'inherit' : s.color } }, s.title), s.sub ? el('p', { class: 'muted' }, s.sub) : null);
    if (s.guidance) card.append(el('details', {}, el('summary', {}, 'What this is about'), el('p', { class: 'small' }, s.guidance)));
    const fieldsBox = el('div', { class: 'stack' });
    for (const f of s.fields) {
      const ta = el('textarea', { class: 'input', rows: String(Math.max(3, f.rows || 3)), maxlength: '2000', id: 'f-' + f.id, value: report.values[f.id] || '' });
      const badge = el('span', { class: 'chip draft-badge', hidden: !report.drafted.includes(f.id) }, 'Drafted by Phoenix. Please check it.');
      ta.addEventListener('input', () => { report.values[f.id] = ta.value; const i = report.drafted.indexOf(f.id); if (i >= 0) { report.drafted.splice(i, 1); badge.hidden = true; } persist(); });
      fieldsBox.append(el('div', { class: 'field', 'data-field': f.id }, el('label', { for: 'f-' + f.id, style: { fontWeight: 700 } }, f.label), ta, badge));
    }
    card.append(fieldsBox);
    if (s.rating) card.append(ratingRow(s));
    const btns = el('div', { class: 'row-wrap' });
    if (aiActive()) btns.append(el('button', { class: 'btn btn-sm', onclick: () => aiFill([s]) }, '✨ Draft this section with Phoenix'));
    if (report.drafted.some((id) => s.fields.some((f) => f.id === id))) btns.append(el('button', { class: 'btn btn-sm', onclick: () => { report.drafted = report.drafted.filter((id) => !s.fields.some((f) => f.id === id)); persist(); drawSection(); } }, 'These look right'));
    if (btns.children.length) card.append(btns);
    secBox.append(card, el('div', { class: 'row-wrap' },
      cur > 0 ? el('button', { class: 'btn', onclick: () => { cur--; sessionStorageSet('phoenix.doc.' + report.id, cur); drawSection(); drawNavState(); } }, 'Back') : null,
      cur < sections.length - 1 ? el('button', { class: 'btn btn-primary', onclick: () => { cur++; sessionStorageSet('phoenix.doc.' + report.id, cur); drawSection(); drawNavState(); } }, 'Next') : el('button', { class: 'btn btn-primary', onclick: () => document.getElementById('doc-actions')?.scrollIntoView({ behavior: 'smooth' }) }, 'Finish: download or save')));
    secBox.querySelector('#sec-h')?.focus({ preventScroll: true });
    drawProgress();
  }
  function ratingRow(s) {
    const wrap = el('div', { class: 'rating10' });
    wrap.append(el('div', { style: { fontWeight: 700 } }, `${s.rating.label} (1 to 10)`), el('div', { class: 'muted small' }, '1 is really struggling, 10 is thriving. A rough feeling is fine, and you can change it any time.'));
    const pills = el('div', { class: 'pills', role: 'radiogroup', 'aria-label': `${s.rating.label}, 1 to 10` });
    for (let i = 1; i <= 10; i++) {
      const input = el('input', { type: 'radio', name: 'r-' + s.id, id: `r-${s.id}-${i}`, value: String(i), checked: report.ratings[s.id] === i ? true : null });
      input.addEventListener('change', () => { report.ratings[s.id] = i; persist(); });
      pills.append(el('span', { class: 'pill' }, input, el('label', { for: `r-${s.id}-${i}` }, String(i))));
    }
    wrap.append(pills, el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { delete report.ratings[s.id]; persist(); drawSection(); } }, 'Clear rating'));
    return wrap;
  }

  // ---- AI drafting
  async function aiFill(list) {
    trackFeature('doc_ai_draft');
    if (!aiActive()) return;
    const wellness = aiMaySeeCheckins() ? [summaryForAI(state.wellness), R.assessmentSummaryForAI(state.reports)].filter(Boolean).join('\n') : '';
    const ctx = R.chatContext({ profile: state.profile, wellness, chats: [...state.chats].sort((a, b) => a.updated - b.updated).slice(-8) });
    if (!R.hasSource(ctx)) { toast('Phoenix has nothing to go on yet. Have a chat first (even a short one), add a few lines under About me in Settings, or fill this in by hand.', { icon: 'ℹ️', ms: 6000 }); return; }
    const go = await new Promise((resolve) => modal({ title: 'Let Phoenix draft this?', onClose: () => resolve(false),
      body: el('div', { class: 'stack' },
        el('p', {}, 'Phoenix will read what you have written to it and draft answers in your voice. It only writes down what you have told it, leaves the rest empty, and never changes anything you have already written. You check every answer afterwards.'),
        el('p', { class: 'small' }, el('strong', {}, 'What is sent to the AI: '), 'your name and About me notes, your own recent messages to Phoenix (not its replies)' + (wellness ? ', and a short summary of your check-ins' : '') + ', and the section questions. Phoenix AI runs through NeuroHub’s server and on to Claude, which is not stored by NeuroHub. Skip this if you would rather it did not.'),
        el('p', { class: 'muted small' }, 'Ratings are never filled in by the AI, because they are your own feelings. The AI can make mistakes.')),
      actions: [{ label: 'Not now', onclick: () => resolve(false) }, { label: 'Send and draft', class: 'btn-primary', onclick: () => { resolve(true); } }] }));
    if (!go) return;
    aiAbort = new AbortController();
    const cfg = providerConfig(state);
    let added = 0, chars = 0, outChars = 0, failed = 0;
    const todo = list.filter((s) => s.fields.some((f) => !(report.values[f.id] || '').trim()));
    for (let i = 0; i < todo.length; i++) {
      const s = todo[i];
      statusEl.textContent = `Phoenix is reading and drafting: ${s.title} (${i + 1} of ${todo.length})…`;
      const { system, user } = R.fillPrompt(s, ctx, report.values);
      let parsed = { ok: false, values: {} };
      for (let attempt = 0; attempt < 2 && !parsed.ok; attempt++) {
        try {
          const reply = await streamChat(cfg, { system, messages: [{ role: 'user', content: attempt ? user + '\n\nYour last reply was not valid JSON. Reply with only the JSON object.' : user }], signal: aiAbort.signal, maxTokens: 900 });
          chars += system.length + user.length; outChars += reply.length;
          parsed = R.parseFill(reply, s.fields.map((f) => f.id));
        } catch (e) { if (aiAbort?.signal.aborted) { statusEl.textContent = 'Stopped.'; aiAbort = null; return; } statusEl.textContent = e.message || 'The AI could not be reached.'; failed++; break; }
      }
      if (!parsed.ok) { failed++; continue; }
      for (const [fid, text] of Object.entries(parsed.values)) {
        if ((report.values[fid] || '').trim()) continue; // never overwrite the person's own words
        report.values[fid] = text; if (!report.drafted.includes(fid)) report.drafted.push(fid); added++;
      }
    }
    aiAbort = null;
    if (added) { report.aiUsed = true; persist(); }
    statusEl.textContent = added ? `Phoenix drafted ${added} answer${added === 1 ? '' : 's'}. Please read them, change anything that is not right, and press “These look right” when you are happy.` : failed ? 'Phoenix could not draft anything this time. You can fill it in by hand, or try again.' : 'Phoenix did not find anything in what you have told it to put here, so those answers are left for you.';
    announce(statusEl.textContent); drawSection();
  }

  // ---- actions
  const nameIn = el('input', { class: 'input', value: report.name || '', maxlength: '60', 'aria-label': 'Name shown on the PDF', placeholder: 'Optional', style: { maxWidth: '18rem' } });
  nameIn.addEventListener('input', () => { report.name = nameIn.value.trim(); persist(); });
  const actions = el('section', { class: 'card', id: 'doc-actions', 'aria-labelledby': 'act-h' }, el('h2', { id: 'act-h' }, 'Finish'));
  const previous = () => { const s = R.ratingSeries(state.reports, doc.id).filter((x) => x.report !== report.id); return s.length ? s[s.length - 1] : null; };
  actions.append(el('label', { class: 'field' }, 'Name to show on the PDF', nameIn));
  const pdfBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
    pdfBtn.disabled = true; statusEl.textContent = 'Making your PDF…';
    try {
      let logoBytes = null; try { const res = await fetch('icons/nh-logo.jpg'); if (res.ok) logoBytes = new Uint8Array(await res.arrayBuffer()); } catch { /* the PDF works without the logo */ }
      const out = await makePdf(doc, report, { previous: previous(), logoBytes });
      download(R.pdfFileName(doc, report), out.bytes, 'application/pdf'); trackFeature('doc_pdf');
      statusEl.textContent = `PDF made (${out.pages} page${out.pages === 1 ? '' : 's'}). ${out.lost ? `${out.lost} character${out.lost === 1 ? '' : 's'} could not be shown and appear as “?”. Use “Print or save as PDF” to keep every character.` : 'It is in your downloads.'}`;
    } catch (e) { statusEl.textContent = 'Could not make the PDF: ' + (e.message || e); }
    pdfBtn.disabled = false; announce(statusEl.textContent);
  } }, '⬇ Download as PDF');
  const printBtn = el('button', { class: 'btn', onclick: () => printView(doc, report, previous()) }, 'Print or save as PDF');
  actions.append(el('div', { class: 'row-wrap' }, pdfBtn, printBtn));
  const saveBtn = el('button', { class: 'btn', onclick: () => {
    if (R.isRated(doc) && !Object.keys(report.ratings).length) { toast('Add at least one rating first, so there is something to track.', { icon: 'ℹ️' }); return; }
    R.snapshot(doc, report); save();
    toast(R.isRated(doc) ? 'Saved. Your ratings now appear in Insights.' : 'Saved to your history.', { icon: '📈' });
    navigate('checkin:insights');
  } }, R.isRated(doc) ? '📈 Save my ratings to Insights' : '📈 Save a snapshot to my history');
  actions.append(el('p', { class: 'muted small' }, R.isRated(doc) ? 'Saving records this set of ratings with today’s date. Do it again every few weeks and Insights will show what has changed.' : 'Saving records that you completed this today, so you can see your progress over time.'), saveBtn);

  const top = el('div', { class: 'row-wrap doc-tools' });
  if (aiActive()) top.append(el('button', { class: 'btn', onclick: () => aiFill(sections) }, '✨ Draft everything I can from what I have told Phoenix'));
  else top.append(el('span', { class: 'muted small' }, 'Turn on Phoenix AI in Settings and it can draft answers for you from your chats. Until then, fill it in one section at a time.'));
  if (R.isRated(doc) && state.wellness.length) top.append(el('button', { class: 'btn', onclick: () => { const latest = perDay(state.wellness).at(-1); const rs = R.ratingsFromCheckin(latest); let n = 0; for (const s of doc.sections) if (s.rating && rs[s.rating.domain] && !report.ratings[s.id]) { report.ratings[s.id] = rs[s.rating.domain]; n++; } persist(); drawSection(); toast(n ? `Started ${n} rating${n === 1 ? '' : 's'} from your latest check-in. Adjust them to how you feel.` : 'Your ratings are already filled in.'); } }, 'Start ratings from my latest check-in'));
  if (aiActive()) top.append(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { navigate('chat'); prefillChat(`I want to fill in my ${doc.title}. Can you ask me about it one area at a time?`); } }, 'Talk it through in chat first'));

  body.append(el('button', { class: 'btn btn-ghost btn-sm back', onclick: () => navigate('checkin:reports') }, '← Documents'),
    el('h2', {}, `${doc.icon} ${doc.title}`), progressEl, top, statusEl, nav, secBox, actions,
    el('p', { class: 'muted small' }, `Based on NeuroHub’s “${doc.source}”, adapted for you to complete yourself. It is a self-reflection, not a clinical assessment or a diagnosis.`));
  drawNav(); drawSection();
}

// small sessionStorage helpers that never throw
function sessionStorageGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } }
function sessionStorageSet(k, v) { try { sessionStorage.setItem(k, String(v)); } catch { /* ignore */ } }

/** Print or save as PDF through the browser or system print dialog. Handles every alphabet and emoji. */
function printView(doc, report, previous) {
  document.getElementById('print-root')?.remove();
  const root = el('div', { id: 'print-root' });
  const rows = R.pdfBlocks(doc, report, { previous }).map((b) => {
    if (b.t === 'intro') return `<p class="pi">${esc(b.text)}</p>`;
    if (b.t === 'note' || b.t === 'help') return `<p class="pn">${esc(b.text)}</p>`;
    if (b.t === 'glance') return `<h2>${esc(b.title)}</h2><table>${b.rows.map((r) => `<tr><td>${esc(r.label)}</td><td><b>${r.value ?? '–'}</b> / ${r.max}</td><td>${b.hasPrev && r.value && r.prev != null ? (r.value - r.prev === 0 ? 'no change' : (r.value - r.prev > 0 ? '+' : '') + (r.value - r.prev)) : ''}</td></tr>`).join('')}</table>`;
    if (b.t === 'section') return `<h2 style="color:${esc(b.color)}">${esc(b.title)}</h2>${b.sub ? `<p class="pi">${esc(b.sub)}</p>` : ''}`;
    if (b.t === 'rating') return `<p><b>${esc(b.label)}: ${b.value} out of ${b.max}</b></p>`;
    if (b.t === 'qa') return `<p class="q">${esc(b.q)}</p><p class="a">${esc(b.a).replace(/\n/g, '<br>')}${b.draft ? ' <i>(drafted by Phoenix, not yet checked)</i>' : ''}</p>`;
    return '';
  }).join('');
  root.innerHTML = `<h1>${esc(doc.title)}</h1>${rows}<p class="pn">Made with Phoenix, a free neuro-affirming AI assistant by NeuroHub Community. Not a clinical assessment or diagnosis.</p>`;
  document.body.append(root);
  const clean = () => { root.remove(); window.removeEventListener('afterprint', clean); };
  window.addEventListener('afterprint', clean);
  setTimeout(() => window.print(), 50);
}
