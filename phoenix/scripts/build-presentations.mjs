// Turns NeuroHub Community's training presentations (PowerPoint and PDF) into app/data/presentations.json: clean,
// searchable text that Phoenix draws on as reference material, next to the neurohubcommunity.org snapshot.
//
//   node scripts/build-presentations.mjs [folder]
//
// The default folder is the one on David's desktop. What it does:
//   - reads every slide and its speaker notes (.pptx / .pptm) and the PDFs that have no PowerPoint twin
//   - drops reference lists, "further reading", thank-you and biography slides, and personal contact details
//   - drops note-to-self speaker notes ("CHANGE WORDING", "Add wellbeing section ...")
//   - skips exact and near duplicates (see SKIP), and decks that are only pictures
//   - splits each deck into chunks of about 1,600 characters so retrieval returns the relevant part, not a whole deck
// To leave a deck out of the app, add a fragment of its file name to EXCLUDE in scripts/presentations-exclude.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { scrubLine } from './privacy.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || 'C:/Users/dgray/OneDrive/David/Desktop/NeuroHub Community Ltd/Presentations';
const OUT = path.join(root, 'app', 'data', 'presentations.json');
const excludeFile = path.join(root, 'scripts', 'presentations-exclude.json');
const EXCLUDE = fs.existsSync(excludeFile) ? JSON.parse(fs.readFileSync(excludeFile, 'utf8')).exclude || [] : [];
// Duplicates and non-content files, decided by reading them.
const SKIP = [/Presentation Template/i, /WEbsite Stuff/i, /Autism 101 professionals Meltham/i, /Aucademy Xmas/i, /\.mp4$/i];

const dec = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const paras = (xml) => [...xml.matchAll(/<a:p[ >][\s\S]*?<\/a:p>/g)].map((p) => dec([...p[0].matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => t[1]).join('')).trim()).filter(Boolean);

const FOOTER = /^(NeuroHub Community Ltd\.?( \| neurohubcommunity\.org)?|NeuroHub|neurohubcommunity\.org|© 20\d\d,? NeuroHub Community Ltd\.?|NeuroHub Community Ltd \| david@[^ ]+ \|.*)$/i;
const CONTACT = /whatsapp|office number|\bemail:|@[a-z0-9-]+\.[a-z.]+|\b0\d{3,4} ?\d{5,6}\b|\+\d{8,}|eventbrite|substack|subscribe|£\d+ per session|book raffle|scan to enter/i;
const NOTE_TO_SELF = /CHANGE WORDING|Add inertia|Reference (Dinah|Damian|Emma|Keiran|Kieran)|Pull nuggets|Add wellbeing Section|Human nature to push out|Gives friendship group|Comes back to mental health|^In our experience|Conceptualised as a response to trauma \(reference|Change to just burnout|Leave this on screen|Say this plainly|Let (this|the discussion)|Pause here|Close with these|Open to questions|Signpost the session|Reinforce the ecosystemic|Give brief, neutral|Resist the urge|Keep this (short|measured)|Name the isolation|Describe the (texture|actual)|Be concrete but not|State both sentences|Introduce the ecosystemic|Brief roadmap|Speak to the ecosystemic|Welcome everyone|Welcome\. This|Welcome to Part Two|We open with this quote|Open by naming|Contact and close|Direct takeaway|Session intention|^—$/i;
const DROP_SLIDE_TITLE = /^(references?|further reading|further resources|further discussion|resources & (further reading|next steps)|my books|my further work|thank you( for listening)?|questions( and discussion| & discussion)?\??|contact me|who (am i|are we)\??|short break|5 minute break|mindfully divergent program|live discussion and q&a.*|supporting my work|discussion( — 20 minutes)?|details of my books.*|questions for practice)$/i;

const prettyTitle = (f) => f.replace(/\.(pptx|pptm|pdf)$/i, '').replace(/\^J/g, ',').replace(/_/g, ':').replace(/\s*\(\d+\)\s*$/, '').replace(/^Embracing Our Autistic Selves - /, 'Embracing Our Autistic Selves: ').replace(/^Supporting Autistic People - /, '').replace(/#$/, '').replace(/\s+/g, ' ').trim();

// People's names and personal details never go into the app (see scripts/privacy.mjs): first-person accounts, presenter
// and credential lines, and any private individual are dropped sentence by sentence.
const clean = (arr) => arr.map((l) => scrubLine(l, 'slide')).filter(Boolean);
// Deck names are shown to users as sources, so they must not carry a person's name or hint at a personal story.
const TITLE_FIX = {
  'Autism 101 professionals Tamir Edit': 'Autism 101 for professionals',
  'falling through the gap lived experience addiction': 'Falling through the gap: autism and addiction services',
  'Inpatient lived experience': 'Autistic people in inpatient care',
  'Is Autism A Disorder Event': 'Is Autism A Disorder?',
};
function slideToText(body, notes) {
  const lines = clean(body.filter((l) => !FOOTER.test(l) && !CONTACT.test(l) && !/^\d{1,2}$/.test(l) && !/^“$/.test(l)));
  const title = lines[0] || '';
  if (DROP_SLIDE_TITLE.test(title.trim())) return null;
  const keepNotes = clean(notes.filter((n) => !NOTE_TO_SELF.test(n) && !CONTACT.test(n)));
  const parts = [...lines];
  if (keepNotes.length) parts.push('(Speaker notes: ' + keepNotes.join(' ') + ')');
  const text = parts.join('\n').trim();
  return text.length > 12 ? { title, text } : null;
}

async function readPptx(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => Number(a.match(/(\d+)\.xml/)[1]) - Number(b.match(/(\d+)\.xml/)[1]));
  const slides = [];
  for (const n of names) {
    const num = n.match(/slide(\d+)\.xml/)[1];
    const body = paras(await zip.file(n).async('string'));
    const nf = zip.file(`ppt/notesSlides/notesSlide${num}.xml`);
    const notes = nf ? paras(await nf.async('string')).filter((x) => !/^\d+$/.test(x)) : [];
    const s = slideToText(body, notes); if (s) slides.push(s);
  }
  return slides;
}
async function readPdf(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true }).promise;
  const slides = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    const lines = c.items.map((x) => x.str + (x.hasEOL ? '\n' : ' ')).join('').split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const s = slideToText(lines, []); if (s) slides.push(s);
  }
  return slides;
}

function chunk(deckTitle, slides, max = 1600) {
  const out = []; let cur = [], len = 0, first = '';
  const flush = () => { if (cur.length) { out.push({ heading: first, text: cur.join('\n\n') }); cur = []; len = 0; first = ''; } };
  for (const s of slides) {
    if (len + s.text.length > max && cur.length) flush();
    if (!cur.length) first = s.title;
    cur.push(s.text); len += s.text.length;
  }
  flush();
  return out.map((c, i) => ({ id: `pres-${crypto.createHash('sha1').update(deckTitle).digest('hex').slice(0, 8)}-${i + 1}`, kind: 'presentation', date: '', url: '', title: `${deckTitle}${c.heading && c.heading !== deckTitle ? ': ' + c.heading : ''}`.slice(0, 160), deck: deckTitle, excerpt: '', cats: [], text: c.text }));
}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const all = walk(SRC).filter((f) => /\.(pptx|pptm|pdf)$/i.test(f));
const base = (f) => path.basename(f).replace(/\.(pptx|pptm|pdf)$/i, '').replace(/\s*\(\d+\)\s*$/, '').toLowerCase();
const pptxBases = new Set(all.filter((f) => /\.(pptx|pptm)$/i.test(f)).map(base));

const seen = new Map(), chunks = [], report = [];
for (const f of all.sort()) {
  const name = path.basename(f);
  if (SKIP.some((r) => r.test(name)) || EXCLUDE.some((x) => name.toLowerCase().includes(String(x).toLowerCase()))) { report.push([name, 'skipped']); continue; }
  const isPdf = /\.pdf$/i.test(f);
  if (isPdf && pptxBases.has(base(f).replace(/\^j/g, '^j'))) { report.push([name, 'skipped (PowerPoint twin used)']); continue; }
  if (isPdf && [...pptxBases].some((b) => b.replace(/[^a-z0-9]/g, '') === base(f).replace(/[^a-z0-9]/g, ''))) { report.push([name, 'skipped (PowerPoint twin used)']); continue; }
  let slides;
  try { slides = isPdf ? await readPdf(f) : await readPptx(f); } catch (e) { report.push([name, 'ERROR ' + e.message]); continue; }
  if (!slides.length) { report.push([name, 'no text']); continue; }
  const sig = crypto.createHash('md5').update(slides.map((s) => s.text).join('|').replace(/\s+/g, ' ')).digest('hex');
  if (seen.has(sig)) { report.push([name, 'duplicate of ' + seen.get(sig)]); continue; }
  const title = TITLE_FIX[prettyTitle(name)] || prettyTitle(name); seen.set(sig, title);
  const cs = chunk(title, slides); chunks.push(...cs);
  report.push([name, `${slides.length} slides, ${cs.length} chunks`]);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ syncedAt: new Date().toISOString(), source: 'NeuroHub Community training presentations', posts: chunks }));
console.table(report.map(([file, result]) => ({ file, result })));
console.log(`${new Set(chunks.map((c) => c.deck)).size} decks, ${chunks.length} chunks, ${Math.round(JSON.stringify(chunks).length / 1024)} KB -> ${path.relative(root, OUT)}`);
