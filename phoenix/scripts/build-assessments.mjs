// Turns NeuroHub's practitioner assessment documents into app/data/assessments.json, the forms Phoenix helps a person fill in.
//
//   node scripts/build-assessments.mjs [path to neurohub-practitioner-app/index.html]
//
// The practitioner app embeds each document as base64 HTML (TOOL_B64). This reads the questions, domains, guidance text and
// rating scales straight from those documents so the wording stays NeuroHub's own, and drops everything that belongs to
// a practitioner rather than the person: names of mentors and consultants, referral and safeguarding triage, "Facilitator
// notes", statutory involvement. Not included on purpose:
//   - initial_consultation: an intake and referral record for staff
//   - family_wellbeing: household composition, statutory involvement and multi-person records
// It also saves the NeuroHub logo used at the top of the PDF (app/icons/nh-logo.jpg).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || 'C:/Users/dgray/WebstormProjects/neurohub-practitioner-app/index.html';
const html = fs.readFileSync(SRC, 'utf8');
const decoded = {};
for (const m of html.matchAll(/^\s*(\w+):\s*"([A-Za-z0-9+/=]{1000,})"/gm)) decoded[m[1]] = Buffer.from(m[2], 'base64').toString('utf8');
for (const need of ['global_assessment', 'burnout_recovery', 'positive_identity']) if (!decoded[need]) throw new Error('template not found in source: ' + need);

const dec = (s) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&middot;/g, '·').replace(/&mdash;/g, '—');
const text = (s) => dec(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const between = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return ''; const j = s.indexOf(b, i + a.length); return s.slice(i + a.length, j < 0 ? undefined : j); };

// the logo
const logo = decoded.global_assessment.match(/<img src="data:image\/[a-z]+;base64,([A-Za-z0-9+/=]+)"/);
if (logo) fs.writeFileSync(path.join(root, 'app', 'icons', 'nh-logo.jpg'), Buffer.from(logo[1], 'base64'));

/** Fields in a chunk: a label followed by a textarea. `idFor(i, id)` gives the stored id. */
function fieldsIn(chunk, idFor, skip = /facilitator notes/i) {
  const out = [];
  for (const m of chunk.matchAll(/<label[^>]*>((?:(?!<label)[\s\S])*?)<\/label>\s*<textarea([^>]*)>/g)) {
    const label = text(m[1]);
    if (skip.test(label)) continue;
    const id = (m[2].match(/\bid="([^"]+)"/) || [])[1];
    const rows = Number((m[2].match(/rows="(\d+)"/) || [])[1]) || 3;
    out.push({ id: idFor(out.length, id), label, rows });
  }
  return out;
}
const domainBlocks = (h) => h.split('<div class="domain">').slice(1).map((b) => b.split(/<div class="(?:summary|safeguard|doc-footer)"/)[0]);
const colorOf = (b) => (b.match(/border-left:4px solid (#[0-9A-Fa-f]{6})/) || [])[1] || '#7C3AED';
const guidanceOf = (b) => text(between(b, '<div class="guidance"', '</div>').replace(/^[^>]*>/, '')).replace(/^Mentor guidance:\s*/i, '');

// ---------------------------------------------------------------- 6PF Global Assessment
const G = decoded.global_assessment;
const gIds = ['sensory', 'executive', 'social', 'emotional', 'identity', 'strengths']; // same ids as the daily check-in domains
const gRadio = ['sensory', 'exec', 'social', 'emotion', 'identity', 'strengths'];
// The practitioner guidance is written for a mentor ("explore the person's...", "safeguarding attention"), so for the person
// filling this in themselves it is restated in the same spirit, addressed to them. The questions and scales stay NeuroHub's own.
const SELF_GUIDANCE = {
  sensory: 'Sensory differences shape how the world feels, across all the senses: sound, sight, touch, movement, body signals, smell and taste. Being very sensitive and being under-sensitive are both real. Changing the environment can lower the load on everything else.',
  executive: 'Planning, starting, remembering and switching between tasks all change with stress, load and burnout, so a hard day does not mean you are failing. Think about what you already do that works, and where more support would help.',
  social: 'Autistic communication styles are valid and varied. Notice what drains and what restores your social energy, how much you mask, and which connections feel real. The aim is connection you do not have to perform, not “passing”.',
  emotional: 'Feelings can be intense or hard to read, and long-term stress or past experiences make it harder. Anxiety and low mood are common alongside neurodivergence. Note what is weighing on you and what helps. If it is too much, the Help button is always there.',
  identity: 'How you understand yourself matters for wellbeing. Think about your relationship with being neurodivergent, how much say you have in your daily life, and whether your life fits your values. Finding out late, internalised ableism and burnout can all affect this.',
  strengths: 'Your strengths and deep interests are part of the plan, not a bonus. Burnout can hide them for a while, which does not mean they are gone. How much energy you have right now helps set realistic goals and pace.',
};
const globalDoc = {
  id: 'global', title: '6PF Global Assessment', short: 'Six areas', icon: '🔍', kind: 'rated',
  blurb: 'A look at all six areas of your life (senses, daily living, connection, emotions, sense of self and strengths), with a 1 to 10 rating for each. Rate again every few weeks to see what changes.',
  source: 'NeuroHub 6PF Global Assessment Record',
  sections: domainBlocks(G).slice(0, 6).map((b, i) => {
    const id = gIds[i];
    const rl = text(between(b, '<span class="rating-label">', '</span>'));
    return {
      id, title: text(between(b, '<div class="domain-name"', '</div>').replace(/^[^>]*>/, '')), color: colorOf(b), guidance: SELF_GUIDANCE[id] || guidanceOf(b),
      fields: fieldsIn(b, (n) => `${id}-${n + 1}`),
      rating: { id: `r-${id}`, label: rl.replace(/\s*\(1[–-]10\)/, ''), min: 1, max: 10, higherIsBetter: true, domain: id },
    };
  }),
  summary: fieldsIn(between(G, '<div class="summary">', '<div class="safeguard">'), (n) => `summary-${n + 1}`),
};
globalDoc.summary = globalDoc.summary.map((f) => ({ ...f, label: f.label.replace(/^Agreed mentoring goals$/i, 'Goals I want to work towards').replace(/^Immediate actions \/ referrals$/i, 'Support or next steps I want to look into') }));

// ---------------------------------------------------------------- Burnout recovery plan
const B = decoded.burnout_recovery;
const burnoutDoc = {
  id: 'burnout', title: '6PF Burnout Recovery Plan', short: 'Burnout plan', icon: '🌱', kind: 'plan',
  blurb: 'A gentle recovery plan for each of six areas, with tiny next steps (“lilipads”) that you can manage on a hard day.',
  source: 'NeuroHub 6PF Burnout Recovery Planning Tool',
  top: fieldsIn(between(B, '<div class="client-band">', '<div class="domain">'), (n, id) => id || `top-${n + 1}`).map((f) => ({ ...f, label: f.label.replace(/^Recovery hopes and goals$/i, 'My hopes for recovery') })),
  sections: domainBlocks(B).slice(0, 6).map((b, i) => ({
    id: `d${i + 1}`, title: text(between(b, '<div class="domain-name"', '</div>').replace(/^[^>]*>/, '')), sub: text(between(b, '<div class="domain-sub">', '</div>')), color: colorOf(b),
    fields: fieldsIn(b, (n, id) => id || `d${i + 1}-${n + 1}`),
  })),
  summary: /<textarea id="f-plan"/.test(B) ? [{ id: 'f-plan', label: 'My integrated recovery plan', rows: 6 }] : [],
};

// ---------------------------------------------------------------- Positive Autistic identity workbook
const P = decoded.positive_identity;
const parts = P.split(/<div class="section" id="section-(\d+)"/).slice(1);
const identitySections = [];
for (let i = 0; i < parts.length; i += 2) {
  const n = Number(parts[i]), b = parts[i + 1].split(/<div class="section"/)[0];
  identitySections.push({
    id: `w${n}`, title: `Week ${n}: ${text(between(b, '<div class="domain-name"', '</div>').replace(/^[^>]*>/, ''))}`, sub: text(between(b, '<div class="domain-sub">', '</div>')), color: colorOf(b),
    guidance: text(between(b, '<div class="framework-note">', '</div>')), fields: fieldsIn(b, (k, id) => id || `w${n}-${k + 1}`),
  });
}
const overview = P.slice(0, P.indexOf('<div class="section" id="section-1"'));
const identityDoc = {
  id: 'identity', title: 'Building a Positive Autistic Identity', short: 'Identity workbook', icon: '🪞', kind: 'plan',
  blurb: 'NeuroHub’s ten-week identity workbook. Take it one week at a time, at your own pace, and come back to it.',
  source: 'NeuroHub “Building a Positive Autistic Identity” 10-week course',
  sections: [
    { id: 'ov', title: 'Overview: where I am starting', sub: '', color: '#7C3AED', guidance: text(between(overview, '<div class="framework-note">', '</div>')) || '', fields: fieldsIn(overview.slice(overview.indexOf('About this course')), (k, id) => id || `ov-${k + 1}`) },
    ...identitySections,
  ],
};

const docs = [globalDoc, burnoutDoc, identityDoc];
for (const d of docs) for (const s of [...(d.sections || []), ...(d.top ? [{ fields: d.top }] : []), ...(d.summary ? [{ fields: d.summary }] : [])]) {
  const seen = new Set();
  for (const f of s.fields) { if (!f.id || seen.has(f.id)) throw new Error(`bad or duplicate field id in ${d.id}: ${f.id}`); seen.add(f.id); }
}
fs.writeFileSync(path.join(root, 'app', 'data', 'assessments.json'), JSON.stringify({ builtFrom: 'neurohub-practitioner-app', docs }, null, 1));
for (const d of docs) {
  const fieldCount = (d.sections || []).reduce((n, s) => n + s.fields.length, 0) + (d.top?.length || 0) + (d.summary?.length || 0);
  console.log(`${d.id}: ${d.sections.length} sections, ${fieldCount} fields, ${(d.sections || []).filter((s) => s.rating).length} ratings`);
}
