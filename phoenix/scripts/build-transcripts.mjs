// Adds NeuroHub live-stream / podcast transcripts (.vtt) to app/data/presentations.json as searchable reference chunks.
//
//   node scripts/build-transcripts.mjs [folder]
//
// Run scripts/build-presentations.mjs first (it rewrites the file); this script then replaces any earlier transcript chunks.
// What it does: reads each listed .vtt, joins the cues into sentences, drops promotional lines (donation links, subscribe
// asks, event tickets), contact details, other people's medical details and weekly-news commentary, then splits the
// transcript into chunks of about 1,600 characters. To leave one out, list a fragment of its file name in
// scripts/transcripts-exclude.json.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { whyDrop } from './privacy.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || 'C:/Users/dgray/Downloads';
const OUT = path.join(root, 'app', 'data', 'presentations.json');
const excludeFile = path.join(root, 'scripts', 'transcripts-exclude.json');
const EXCLUDE = fs.existsSync(excludeFile) ? JSON.parse(fs.readFileSync(excludeFile, 'utf8')).exclude || [] : [];

// file-name fragment -> [title, privacy mode]. TWAN3 (a weekly news round-up) is deliberately left out: it is dated news, not lasting knowledge.
// Titles are shown to users, so they carry no names. Modes (scripts/privacy.mjs): 'impersonal' keeps only sentences with no
// first-person or family content (for conversations full of people's own lives), 'transcript' also allows opinions and teaching in the first person.
const FILES = [
  ['Being Autistic In The World Of Healthcare', 'Being autistic in the world of healthcare (live discussion)', 'impersonal'],
  ['Finding Peace When The World Is Too Much', 'Finding peace when the world is too much: glimmers, craft and Cavendish Space (live discussion)', 'impersonal'],
  ['Intersecting identities', 'Intersecting identities: the Double Rainbow (live discussion)', 'impersonal'],
  ['Autism & Substance Use', 'Autism and substance use (talk)', 'impersonal'],
  ['A Multitude Of Drops', 'A Multitude of Drops, episode 1: philosophies of autistic identity (podcast)', 'transcript'],
  ['Supporting Autistic People _Part 2_', 'Supporting autistic people, part 2 (live discussion)', 'transcript'],
];
const PROMO = /ko-?fi|co-fi|profi\.com|bit\.ly|donat|subscribe|\blike,? (a )?share|give us a like|connect\.neurohub|neurohubcommunity\.org|heartbeat app|insight timer|tickets?\b|eventbrite|substack|facebook|youtube|patreon|buy us a coffee|watch back on the recording|check out (our|the) website|the description section|next one, which will be|see you next week|thank you (so much )?for (being here|tuning|joining|listening)/i;
const OTHER_PEOPLE_HEALTH = /\bMRI\b|fractur|pneumothorax|shoulder|off a ladder|duct tape/i;
const NEWS = /chlorine|dioxide|bleach/i;
const CONTACT = /@[a-z0-9-]+\.[a-z.]+|\b0\d{3,4} ?\d{5,6}\b|\+\d{8,}|https?:\/\//i;

const vttToText = (raw) => {
  const lines = raw.replace(/\r/g, '').split('\n');
  const out = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t || t === 'WEBVTT' || /^NOTE\b/.test(t) || /-->/.test(t) || /^\d+$/.test(t)) continue;
    out.push(t.replace(/<[^>]+>/g, '').replace(/^[A-Z][\w .'-]{0,30}:\s+(?=\S)/, ''));
  }
  return out.join(' ').replace(/\s+/g, ' ');
};

const sentences = (text) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) || [];

function chunkText(sents, max = 1600) {
  const out = []; let cur = '';
  for (const s of sents) {
    if (cur && cur.length + s.length > max) { out.push(cur.trim()); cur = ''; }
    cur += s + ' ';
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
existing.posts = existing.posts.filter((p) => p.kind !== 'transcript');
const files = fs.readdirSync(SRC).filter((f) => /\.vtt$/i.test(f));
const report = [];
const dropTotals = {};
for (const [frag, title, mode] of FILES) {
  const name = files.find((f) => f.toLowerCase().includes(frag.toLowerCase()));
  if (!name) { report.push([frag, 'not found']); continue; }
  if (EXCLUDE.some((x) => name.toLowerCase().includes(String(x).toLowerCase()))) { report.push([name, 'excluded']); continue; }
  const all = sentences(vttToText(fs.readFileSync(path.join(SRC, name), 'utf8')));
  const kept = [];
  for (const s of all) {
    const why = PROMO.test(s) ? 'promo' : CONTACT.test(s) ? 'contact' : OTHER_PEOPLE_HEALTH.test(s) ? 'health' : NEWS.test(s) ? 'news' : whyDrop(s, mode);
    if (why) dropTotals[why] = (dropTotals[why] || 0) + 1; else kept.push(s);
  }
  const chunks = chunkText(kept);
  const h = crypto.createHash('sha1').update(title).digest('hex').slice(0, 8);
  chunks.forEach((text, i) => existing.posts.push({ id: `tr-${h}-${i + 1}`, kind: 'transcript', date: '', url: '', title: `${title} (part ${i + 1})`, deck: title, excerpt: '', cats: [], text }));
  report.push([name, `${all.length} sentences, ${all.length - kept.length} dropped, ${chunks.length} chunks`]);
}
existing.source = 'NeuroHub Community training presentations and transcripts';
fs.writeFileSync(OUT, JSON.stringify(existing));
console.table(report.map(([file, result]) => ({ file, result })));
console.log('dropped sentences by reason:', dropTotals);
console.log(`${existing.posts.filter((p) => p.kind === 'transcript').length} transcript chunks; file now ${Math.round(fs.statSync(OUT).size / 1024)} KB`);
