import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { offlineReply, findTopic, offlineTaskSteps } from '../app/js/offline.js';
import { CRISIS_RE } from '../app/js/safety.js';
import { buildSystem } from '../app/js/persona.js';
import { streamChat, listModels, testConnection, _setFetcher } from '../app/js/providers.js';
import { KB } from '../app/js/kb.js';

// ---- offline helper
test('knowledge base entries are complete and unique', () => {
  const ids = new Set();
  for (const e of KB) {
    assert.ok(e.id && e.title && e.what && e.why && e.helps && e.terms?.length, e.id);
    assert.ok(!ids.has(e.id), 'duplicate ' + e.id); ids.add(e.id);
  }
});

test('topics are found', () => {
  assert.equal(findTopic('what is masking?')?.id, 'masking');
  assert.equal(findTopic('tell me about monotropism')?.id, 'monotropism');
  assert.equal(findTopic('why do I stim')?.id, 'stimming');
  assert.equal(findTopic('what is RSD')?.id, 'rsd');
  assert.equal(findTopic('what is AuDHD')?.id, 'audhd');
  assert.equal(findTopic('the weather is nice'), null);
});

test('overwhelm statements get a low-demand reply, questions about topics get the topic', () => {
  const a = offlineReply('I am so overwhelmed right now');
  assert.match(a.text, /do not have to fix anything/);
  assert.ok(a.actions.some((x) => x.go === 'tool:breathing'));
  const b = offlineReply('what is a meltdown?');
  assert.match(b.text, /Meltdowns/);
  const c = offlineReply("I can't start my tax return");
  assert.ok(c.actions.some((x) => x.go === 'tool:tasks'));
});

test('offline helper is honest about being limited and never claims to be a person', () => {
  const r = offlineReply('are you a real person?');
  assert.match(r.text, /computer program/);
  const f = offlineReply('what do you think about my landlord');
  assert.match(f.text, /built-in helper/);
});

test('task steps scale with energy', () => {
  assert.ok(offlineTaskSteps('email', 'low').length < offlineTaskSteps('email', 'high').length);
  assert.match(offlineTaskSteps('email')[1], /email/);
});

// ---- crisis detection
test('crisis detection catches the obvious and ignores the everyday', () => {
  for (const s of ['I want to die', 'thinking about suicide', 'I keep wanting to hurt myself', "I can't go on", 'I am being abused']) assert.ok(CRISIS_RE.test(s), s);
  for (const s of ['I am tired', 'what is masking', 'my brother is autistic', 'I feel overwhelmed']) assert.ok(!CRISIS_RE.test(s), s);
});

// ---- persona
test('system prompt carries the personÃ¢â‚¬â„¢s settings and crisis details', () => {
  const s = buildSystem({ profile: { name: 'Sam', about: 'ADHD, hate long replies', neurotypes: ['ADHD'] }, prefs: { replyLength: 'short', tone: 'direct', literal: true }, crisisBlock: 'Samaritans 116 123', crisisFlag: true });
  for (const needle of ['Sam', 'ADHD', 'direct', 'LITERAL MODE', 'Samaritans 116 123', 'SAFETY FLAG', 'not a therapist']) assert.ok(s.includes(needle), needle);
});

// ---- providers, against fake servers that speak each protocol
function serve(handler) {
  return new Promise((resolve) => {
    const srv = http.createServer(handler).listen(0, '127.0.0.1', () => resolve({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}
const body = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b)); });

test('ollama streaming + model list', async () => {
  _setFetcher(null);
  const { srv, url } = await serve(async (req, res) => {
    if (req.url === '/api/tags') { res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'gemma3:4b' }] })); return; }
    const b = JSON.parse(await body(req));
    assert.equal(b.messages[0].role, 'system');
    res.write(JSON.stringify({ message: { content: 'Hel' }, done: false }) + '\n');
    res.write(JSON.stringify({ message: { content: 'lo' }, done: false }) + '\n');
    res.end(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
  });
  const cfg = { kind: 'ollama', url, model: 'llama3.2:3b' };
  const seen = [];
  const full = await streamChat(cfg, { system: 'x', messages: [{ role: 'user', content: 'hi' }], onText: (d) => seen.push(d) });
  assert.equal(full, 'Hello'); assert.deepEqual(seen, ['Hel', 'lo']);
  assert.deepEqual(await listModels(cfg), ['gemma3:4b', 'llama3.2:3b']);
  const t = await testConnection(cfg);
  assert.ok(t.ok, t.message);
  srv.close();
});

test('openai-compatible streaming, auth header, and 401 message', async () => {
  const { srv, url } = await serve(async (req, res) => {
    if (req.headers.authorization !== 'Bearer good') { res.statusCode = 401; res.end(JSON.stringify({ error: { message: 'bad key' } })); return; }
    if (req.url === '/models') { res.end(JSON.stringify({ data: [{ id: 'models/m1' }, { id: 'm2' }] })); return; }
    await body(req);
    res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'A' } }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'B' } }] }) + '\n\n');
    res.end('data: [DONE]\n\n');
  });
  const ok = { kind: 'openai', url, key: 'good', model: 'm1' };
  assert.equal(await streamChat(ok, { system: 's', messages: [{ role: 'user', content: 'x' }] }), 'AB');
  assert.deepEqual(await listModels(ok), ['m1', 'm2']);
  await assert.rejects(() => streamChat({ ...ok, key: 'bad' }, { system: 's', messages: [{ role: 'user', content: 'x' }] }), /did not accept the key/);
  srv.close();
});

test('anthropic streaming format', async () => {
  const { srv, url } = await serve(async (req, res) => {
    assert.equal(req.headers['x-api-key'], 'k'); assert.equal(req.headers['anthropic-version'], '2023-06-01');
    const b = JSON.parse(await body(req));
    assert.equal(b.system, 'sys'); assert.equal(b.stream, true);
    const ev = (o) => `event: ${o.type}\ndata: ${JSON.stringify(o)}\n\n`;
    res.write(ev({ type: 'message_start', message: {} }));
    res.write(ev({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi ' } }));
    res.write(ev({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'there' } }));
    res.end(ev({ type: 'message_stop' }));
  });
  const full = await streamChat({ kind: 'anthropic', url, key: 'k', model: 'm' }, { system: 'sys', messages: [{ role: 'user', content: 'x' }] });
  assert.equal(full, 'Hi there');
  srv.close();
});

test('unreachable Ollama gives a helpful message, and abort works', async () => {
  await assert.rejects(() => streamChat({ kind: 'ollama', url: 'http://127.0.0.1:1', model: 'm' }, { system: 's', messages: [{ role: 'user', content: 'x' }] }), /Is it running/);
  const { srv, url } = await serve((req, res) => { res.write(JSON.stringify({ message: { content: 'a' } }) + '\n'); /* never ends */ });
  const ac = new AbortController();
  const p = streamChat({ kind: 'ollama', url, model: 'm' }, { system: 's', messages: [{ role: 'user', content: 'x' }], signal: ac.signal, onText: () => ac.abort() });
  await assert.rejects(p, (e) => e.name === 'AbortError');
  srv.closeAllConnections?.(); srv.close();
});


// ---- the AI is only ever NeuroHub's own (shared) or none (offline)
test('provider policy: anything else becomes the shared AI and saved keys are erased', async () => {
  const { normaliseProvider, KINDS } = await import('../app/js/provider-policy.js');
  assert.deepEqual(KINDS, ['shared', 'offline']);
  const old = { provider: { kind: 'anthropic', anthropic: { key: 'sk-ant-secret' }, openai: { key: 'x' }, ollama: { url: 'http://localhost:11434' } } };
  assert.equal(normaliseProvider(old), true);
  assert.deepEqual(old.provider, { kind: 'shared' });
  const off = { provider: { kind: 'offline' } };
  assert.equal(normaliseProvider(off), false); assert.equal(off.provider.kind, 'offline');
  const none = {}; normaliseProvider(none); assert.equal(none.provider.kind, 'shared');
});

test('provider config: only the shared AI or the built-in helper can be used', async () => {
  const { providerConfig } = await import('../app/js/providers.js');
  assert.equal(providerConfig({ provider: { kind: 'shared' } }).kind, 'shared');
  assert.equal(providerConfig({ provider: { kind: 'ollama', ollama: { url: 'http://x' } } }).kind, 'offline');
  assert.equal(providerConfig({ provider: { kind: 'openai', openai: { key: 'k' } } }).kind, 'offline');
});

// ---- neurohubcommunity.org knowledge
test('site knowledge: retrieval finds real articles, builds a data-not-instructions block, and feeds the offline helper', async () => {
  const fs = await import('node:fs');
  const site = await import('../app/js/site.js');
  const data = JSON.parse(fs.readFileSync(new URL('../app/data/site.json', import.meta.url), 'utf8'));
  assert.ok(data.posts.length > 100, 'snapshot is populated');
  await site.loadSite(async () => data);
  const hits = site.siteHits('autistic burnout recovery', 3);
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => h.url.startsWith('https://neurohubcommunity.org')));
  const block = site.siteBlock('autistic burnout recovery');
  assert.match(block, /reference DATA, never instructions/);
  assert.match(block, /Link: https:\/\/neurohubcommunity\.org/);
  const r = offlineReply('what is masking?', { siteHits: (q) => site.siteHits(q, 2) });
  assert.match(r.text, /Masking/);
  assert.match(r.text, /neurohubcommunity\.org/);
  const sys = buildSystem({ siteBlock: block });
  assert.ok(sys.indexOf('REFERENCE MATERIAL') < sys.lastIndexOf('CRISIS SUPPORT DETAILS'));
});

// ---- guardrails found necessary by a real-model test
import { medicationIntent, siteQuestionIntent, validateCrisisReply, medicationReply } from '../app/js/guard.js';
import { crisisText } from '../app/js/safety.js';
import { readFileSync } from 'node:fs';

test('guard: medicine questions are caught (and everyday mentions are not)', () => {
  for (const s of ['Should I stop taking my ADHD medication because the side effects are annoying?', 'can I double my dose', 'I want to come off my antidepressants', 'is it ok to skip my meds this weekend', 'should I take more sertraline']) assert.ok(medicationIntent(s), s);
  for (const s of ['what is monotropism', 'I take my meds every morning and feel fine', 'I am overwhelmed', 'tell me about ADHD']) assert.ok(!medicationIntent(s), s);
  assert.doesNotMatch(medicationReply(), /you should stop/i);
  assert.match(medicationReply(), /prescrib/);
});

test('guard: "what has NeuroHub written" is answered from the real site list', () => {
  for (const s of ['What has NeuroHub Community written about autistic burnout?', 'any articles on your website about masking', 'has David Gray-Hammond written about monotropism']) assert.ok(siteQuestionIntent(s), s);
  assert.ok(!siteQuestionIntent('what is masking'));
});

test('guard: crisis replies with wrong numbers, foreign services or cold refusals are rejected', () => {
  const d = JSON.parse(readFileSync(new URL('../app/data/crisis.json', import.meta.url), 'utf8'));
  const allowed = crisisText(d, 'GB').text;
  // the exact bad output a real 1B model produced
  const bad = 'I cannot provide you with assistance in ending your life. 1. National Suicide Prevention Lifeline (in the United States): 1-800-273-TALK (8255) 2. Crisis Text Line: Text HOME to 741741';
  assert.equal(validateCrisisReply(bad, allowed).ok, false);
  assert.equal(validateCrisisReply('That sounds incredibly painful, and I am glad you told me. Please call Samaritans on 116 123 now, or text SHOUT to 85258. I am here.', allowed).ok, true);
  assert.equal(validateCrisisReply('Please call 0800 123 4567 right away, they can help you tonight.', allowed).ok, false);
  assert.equal(validateCrisisReply('You could visit madeupcharity.org for support, and I am glad you told me.', allowed).ok, false);
});

test('guard: small models are recognised from their names', async () => {
  const { isSmallModel } = await import('../app/js/guard.js');
  for (const n of ['llama3.2:1b', 'qwen2.5:0.5b', 'gemma3:1b', 'phi3-mini', 'tinyllama']) assert.ok(isSmallModel(n), n);
  for (const n of ['llama3.2:3b', 'llama3.1:8b', 'qwen2.5:7b', 'gemma3:12b', 'mistral', '']) assert.ok(!isSmallModel(n), n);
});


// ---- 6PF-Wellness check-ins, insights and advice
import * as S from '../app/js/sixpf.js';

import { buildIndex, search } from '../app/js/search.js';

const mk = (dayOffset, mood, ratings = {}, note = '') => {
  const d = new Date('2026-09-29T12:00:00'); d.setDate(d.getDate() + dayOffset);
  const e = S.freshEntry(); e.id = 'e' + dayOffset; e.createdAt = d.toISOString(); e.overallMood = mood;
  for (const dm of e.domains) dm.rating = ratings[dm.id] ?? mood;
  if (note) e.domains[0].note = note;
  return e;
};
const NOW = new Date('2026-09-29T20:00:00');

test('sixpf: streaks, one entry per day and today detection', () => {
  const list = [mk(-3, 3), mk(-2, 3), mk(-1, 4), mk(0, 2), { ...mk(0, 5), id: 'later', createdAt: new Date('2026-09-29T18:00:00').toISOString() }];
  assert.equal(S.perDay(list).length, 4, 'two entries on one day count once (the later one)');
  assert.equal(S.perDay(list).at(-1).overallMood, 5);
  assert.equal(S.streak(list, NOW), 4);
  assert.equal(S.checkedInToday(list, NOW), true);
  assert.equal(S.streak([mk(-2, 3), mk(-1, 3)], NOW), 2, 'today is not a broken streak until it is over');
  assert.equal(S.streak([mk(-5, 3)], NOW), 0);
  assert.equal(S.longestStreak([mk(-9, 3), mk(-8, 3), mk(-7, 3), mk(-2, 3), mk(-1, 3)]), 3);
});

test('sixpf: averages and change against the previous period', () => {
  const list = [];
  for (let i = -13; i <= -7; i++) list.push(mk(i, 2));
  for (let i = -6; i <= 0; i++) list.push(mk(i, 4));
  const c = S.changes(list, 7, NOW);
  assert.equal(c.current.mood, 4); assert.equal(c.previous.mood, 2); assert.equal(c.change.mood, 2);
  assert.equal(S.inRange(list, 7, NOW).length, 7);
  assert.equal(S.direction([mk(-5, 2), mk(-4, 2), mk(-3, 2), mk(-2, 4), mk(-1, 4), mk(0, 4)], 'mood').dir, 'up');
  assert.equal(S.direction([mk(-5, 4), mk(-4, 4), mk(-3, 4), mk(-2, 2), mk(-1, 2), mk(0, 2)], 'mood').dir, 'down');
});

test('sixpf: advice is cautious, specific and never diagnoses', () => {
  assert.deepEqual(S.advice([]), []);
  const low = [mk(-3, 3), mk(-2, 3), mk(-1, 2, { sensory: 1 }), mk(0, 2, { sensory: 1, executive: 2, emotional: 2 })];
  const a = S.advice(low, NOW);
  assert.ok(a.some((x) => x.id === 'low-sensory'), 'flags the low sensory area');
  assert.ok(a.some((x) => x.id === 'burnout'), 'several key areas low together shows the early-burnout note');
  for (const x of a) assert.ok(!/diagnos(e|is)d? (you|with)|you have (depression|autism|adhd)/i.test(x.text), 'no diagnosing: ' + x.id);
  const crisis = S.advice([mk(0, 1)], NOW);
  assert.equal(crisis[0].id, 'support'); assert.ok(crisis[0].actions.some((x) => x.go === 'help'));
  const fine = S.advice([mk(-1, 4), mk(0, 4)], NOW);
  assert.ok(fine.every((x) => x.priority >= 5), 'good days get no alarm');
});

test('sixpf: every advice link points at something that exists', () => {
  const ids = new Set(KB.map((e) => e.id));
  const tools = new Set(['breathing', 'grounding', 'sensory', 'checkin', 'focus', 'tasks', 'scripts', 'plan']);
  const all = [...S.DOMAINS.map((d) => S.advice([mk(0, 2, { [d.id]: 1 })], NOW)), S.advice([mk(-3, 3), mk(-2, 3), mk(-1, 2, { sensory: 1 }), mk(0, 2, { sensory: 1, executive: 2, emotional: 2 })], NOW)].flat();
  for (const x of all) for (const l of x.actions || []) {
    const [kind, id] = l.go.split(':');
    if (kind === 'learn') assert.ok(ids.has(id), 'missing topic ' + id);
    else if (kind === 'tool') assert.ok(tools.has(id), 'missing tool ' + id);
    else assert.ok(['help', 'checkin'].includes(kind) || l.go.startsWith('checkin:'), l.go);
  }
});

test('sixpf: pattern finder needs enough data, and summaries carry numbers and notes but no instructions', () => {
  const few = [mk(-3, 3), mk(-2, 4)];
  assert.equal(S.strongestLink(few), null);
  const many = []; for (let i = -11; i <= 0; i++) { const v = 1 + (Math.abs(i) % 5); many.push(mk(i, 3, { sensory: v, emotional: v, social: 3 })); }
  const link = S.strongestLink(many);
  assert.ok(link && Math.abs(link.r) > 0.9);
  const sum = S.summaryForAI([mk(-1, 3, {}, 'loud office'), mk(0, 2)], NOW);
  assert.match(sum, /overall 2\/5/); assert.match(sum, /loud office/); assert.match(sum, /Checked in today: yes/);
  assert.equal(S.summaryForAI([]), '');
  assert.match(S.shareableSummary([mk(0, 3)], 30, NOW), /Overall: average 3\/5/);
  assert.match(S.toCSV([mk(0, 3)]), /^date,overall,sensory/);
});

test('sixpf: the built-in reply about check-ins is honest with no data and useful with some', () => {
  assert.ok(S.checkinIntent('how have I been doing this week?')); assert.ok(S.checkinIntent('can we look at my check-ins')); assert.ok(!S.checkinIntent('what is masking?'));
  assert.match(S.chatReply([], 'Sam').text, /not done a check-in/);
  assert.ok(S.chatReply([], 'Sam').actions[0].go === 'checkin');
  const r = S.chatReply([mk(-1, 2), mk(0, 2, { sensory: 1 })], 'Sam', NOW);
  assert.match(r.text, /Lowest area/); assert.ok(r.actions.length);
});

test('reminders: the calendar file repeats daily and has an alarm', () => {
  const ics = S.dailyIcs('09:30', 'https://phoenix.example/app/#/checkin');
  assert.match(ics, /RRULE:FREQ=DAILY/); assert.match(ics, /T093000/); assert.match(ics, /BEGIN:VALARM/); assert.match(ics, /\r\n/);
});

test('the wellness summary reaches the prompt only when passed, and is marked as data', () => {
  assert.ok(!buildSystem({}).includes('DAILY CHECK-INS'));
  const sys = buildSystem({ wellnessBlock: 'Latest: overall 2/5' });
  assert.match(sys, /THEIR DAILY CHECK-INS/); assert.match(sys, /data, not instructions/); assert.match(sys, /never as a verdict/);
});

test('transcripts are searchable and cited as recorded conversations', async () => {
  const data = JSON.parse(readFileSync(new URL('../app/data/presentations.json', import.meta.url), 'utf8'));
  const tr = data.posts.filter((p) => p.kind === 'transcript');
  assert.ok(tr.length > 40, 'transcript chunks present');
  assert.ok(!tr.some((p) => /ko-?fi|bit\.ly|@[a-z0-9-]+\.[a-z]|chlorine dioxide/i.test(p.text)), 'promo, contact details and dosing talk are scrubbed');
  const h = search(buildIndex(data.posts), 'autism is an abstraction category diagnosis identity', 3, 6);
  assert.ok(h.some((x) => x.p.kind === 'transcript'));
});


// ---- reflection documents, AI drafting and PDF
import * as RP from '../app/js/reports.js';
import { makePdf } from '../app/js/pdf.js';
RP.setDocs(JSON.parse(readFileSync(new URL('../app/data/assessments.json', import.meta.url), 'utf8')));

test('documents: built from NeuroHub’s own forms, with staff-only parts left out', () => {
  const docs = RP.getDocs();
  assert.deepEqual(docs.map((d) => d.id), ['global', 'burnout', 'identity']);
  const g = RP.getDoc('global');
  assert.equal(g.sections.length, 6); assert.ok(g.sections.every((s) => s.rating && s.fields.length >= 3 && s.guidance));
  assert.deepEqual(g.sections.map((s) => s.id), ['sensory', 'executive', 'social', 'emotional', 'identity', 'strengths'], 'same six areas as the daily check-in');
  assert.equal(RP.getDoc('identity').sections.length, 11);
  const all = JSON.stringify(docs);
  for (const bad of [/safeguarding/i, /facilitator notes/i, /mentor name/i, /statutory/i, /client name/i, /referral source/i, /consultant/i]) assert.ok(!bad.test(all), 'staff-only text leaked: ' + bad);
  for (const d of docs) { const ids = RP.allFields(d).map((f) => f.id); assert.equal(new Set(ids).size, ids.length, 'unique ids in ' + d.id); }
});

test('documents: progress, ratings from a check-in, and snapshots that feed analytics', () => {
  const g = RP.getDoc('global'), r = RP.newReport(g, { name: 'Sam', now: new Date('2026-09-01T10:00:00Z') });
  assert.equal(RP.progress(g, r).pct, 0);
  r.values['sensory-1'] = 'Loud places wear me out.'; r.ratings.sensory = 3; r.ratings.emotional = 6;
  const p = RP.progress(g, r); assert.equal(p.answered, 1); assert.equal(p.rated, 2); assert.ok(p.pct > 0 && p.pct < 100);
  assert.deepEqual(RP.ratingsFromCheckin({ domains: [{ id: 'sensory', rating: 2 }, { id: 'social', rating: 5 }] }), { sensory: 4, social: 10 });
  RP.snapshot(g, r, new Date('2026-09-01T10:00:00Z'));
  const r2 = RP.newReport(g, { from: r, now: new Date('2026-10-13T10:00:00Z') });
  assert.equal(r2.values['sensory-1'], 'Loud places wear me out.'); assert.deepEqual(r2.snapshots, []);
  r2.ratings.sensory = 5; r2.ratings.emotional = 5; RP.snapshot(g, r2, new Date('2026-10-13T10:00:00Z'));
  const series = RP.ratingSeries([r, r2]);
  assert.equal(series.length, 2); assert.equal(series[1].ratings.sensory, 5);
  const ch = RP.ratingChanges(series);
  assert.equal(ch.find((c) => c.domain.id === 'sensory').delta, 2); assert.equal(ch.find((c) => c.domain.id === 'emotional').delta, -1);
  assert.match(RP.assessmentSummaryForAI([r, r2]), /Sensory 5/); assert.match(RP.assessmentSummaryForAI([r, r2]), /Sensory \+2/);
  assert.equal(RP.timeline([r, r2]).length, 2); assert.equal(RP.assessmentSummaryForAI([]), '');
});

test('documents: the AI is only given the person’s own words, and its reply is checked', () => {
  const ctx = RP.chatContext({ profile: { name: 'Sam', about: 'ADHD, hate loud offices' }, chats: [{ messages: [{ role: 'user', content: 'I get exhausted after open plan days' }, { role: 'assistant', content: 'You should try meditation' }, { role: 'user', content: 'I want to end it all', crisis: true }] }] });
  assert.match(ctx, /exhausted after open plan/); assert.ok(!/meditation/.test(ctx), 'the assistant’s own replies are not facts about the person'); assert.ok(!/end it all/.test(ctx), 'crisis messages are not copied into a form');
  assert.ok(RP.hasSource(ctx)); assert.ok(!RP.hasSource(''));
  const g = RP.getDoc('global'), { system, user } = RP.fillPrompt(g.sections[0], ctx, { 'sensory-2': 'already written' });
  assert.match(system, /ONLY what they have told/); assert.match(system, /empty string/); assert.match(system, /Do not give ratings/); assert.match(user, /"sensory-1"/); assert.match(user, /already written|sensory-2/);
  const ids = g.sections[0].fields.map((f) => f.id);
  const ok = RP.parseFill('```json\n{"sensory-1":"Open plan offices exhaust me.","sensory-2":"N/A","sensory-3":"none","bogus":"x","sensory-4":["a","b"]}\n```', ids);
  assert.ok(ok.ok); assert.deepEqual(Object.keys(ok.values).sort(), ['sensory-1', 'sensory-4']); assert.equal(ok.values['sensory-4'], 'a. b'); assert.equal(ok.dropped, 1);
  assert.equal(RP.parseFill('sorry, I cannot', ids).ok, false); assert.equal(RP.parseFill('{ not json }', ids).ok, false);
  assert.ok(RP.parseFill(JSON.stringify({ 'sensory-1': 'x'.repeat(5000) }), ids).values['sensory-1'].length <= 1201);
  assert.ok(RP.reportIntent('can you fill in my 6PF global assessment')); assert.ok(RP.reportIntent('make me a PDF')); assert.ok(!RP.reportIntent('what does an autism assessment involve?'));
});

test('documents: the PDF is a real, multi-page A4 file, marks AI drafts, and reports characters it cannot draw', async () => {
  const g = RP.getDoc('global'), r = RP.newReport(g, { name: 'Sam' });
  for (const f of RP.allFields(g)) r.values[f.id] = 'I find this hard when things are loud and unpredictable. '.repeat(6);
  for (const s of g.sections) r.ratings[s.id] = 4; r.aiUsed = true; r.drafted = ['sensory-1'];
  const out = await makePdf(g, r, { logoBytes: readFileSync(new URL('../app/icons/nh-logo.jpg', import.meta.url)) });
  assert.equal(Buffer.from(out.bytes.slice(0, 5)).toString(), '%PDF-'); assert.ok(out.pages >= 3, 'long answers flow onto more pages: ' + out.pages); assert.equal(out.lost, 0);
  const emoji = RP.newReport(g); emoji.values['sensory-1'] = 'Cats 😀 and 日本語'; assert.ok((await makePdf(g, emoji)).lost >= 2);
  assert.equal(RP.winAnsi('It’s “fine” – café').lost, 0); assert.equal(RP.winAnsi('a😀b').text, 'a?b');
  const blocks = RP.pdfBlocks(g, r); assert.ok(blocks.some((b) => b.t === 'qa' && b.draft)); assert.ok(blocks.some((b) => b.t === 'help'));
  assert.match(blocks.find((b) => b.t === 'note').text, /AI assistant drafted|Phoenix drafted/);
  assert.ok(RP.pdfBlocks(g, RP.newReport(g)).some((b) => /Nothing has been filled in/.test(b.text || '')));
});

test('donate: once or monthly, four suggested amounts or your own, through Stripe (Ko-fi until the links are set)', async () => {
  const { donateUrl, AMOUNTS } = await import('../app/js/donate.js');
  const L = await import('../app/js/donate-links.js');
  assert.deepEqual(AMOUNTS, [5, 10, 25, 50]); assert.deepEqual(L.FREQUENCIES, ['once', 'monthly']);
  const ok = /^https:\/\/(buy\.stripe\.com|donate\.stripe\.com|ko-fi\.com)\//;
  for (const f of L.FREQUENCIES) for (const a of [...AMOUNTS, 'other']) assert.match(L.linkFor(f, a), ok, f + ' ' + a);
  assert.equal(donateUrl(25), L.linkFor('once', 25)); assert.equal(donateUrl(25, 'monthly'), L.linkFor('monthly', 25));
  assert.equal(L.clickKey('once', 25), '25'); assert.equal(L.clickKey('monthly', 'other'), 'mother');
  assert.ok(!JSON.stringify(L.LINKS).includes('paypal'), 'PayPal is gone');
});

test('privacy: no private individual’s name, place or personal detail is anywhere Phoenix can read it', async () => {
  const { NAME_RE, PLACE_RE, FIRST_PERSON_RE, HEALTH_RE, CONTACT_RE } = await import('../scripts/privacy.mjs');
  const data = JSON.parse(readFileSync(new URL('../app/data/presentations.json', import.meta.url), 'utf8'));
  for (const p of data.posts) {
    const where = `${p.kind} “${p.deck || p.title}”`;
    assert.ok(!NAME_RE.test(p.text) && !NAME_RE.test(p.title) && !NAME_RE.test(p.deck || ''), 'a name is in ' + where + ': ' + (p.text.match(NAME_RE) || p.title.match(NAME_RE) || [''])[0]);
    assert.ok(!PLACE_RE.test(p.text), 'a personal place is in ' + where);
    assert.ok(!CONTACT_RE.test(p.text), 'contact details in ' + where);
    for (const s of p.text.split(/(?<=[.!?])\s+/)) assert.ok(!(FIRST_PERSON_RE.test(s) && HEALTH_RE.test(s)), 'a first-person health detail is in ' + where + ': ' + s.slice(0, 80));
  }
  assert.ok(!data.posts.some((p) => p.kind === 'presentation' && FIRST_PERSON_RE.test(p.text)), 'slides contain first-person accounts');
  const kbText = JSON.stringify(KB);
  for (const bad of [/schizophrenic and in long-term recovery/i, /ten years of recovery/i, /himself was misdiagnosed/i, /Ryan Bowen/, /Helen Edgar/, /Betsy|Adele Murray|Charlie Hart|Azi\b/]) assert.ok(!bad.test(kbText), 'personal detail in the built-in topics: ' + bad);
  assert.ok(!/Tamir/.test(JSON.stringify(data.posts.map((p) => p.deck))), 'deck titles carry names');
});

test('privacy: the AI is told never to share names or personal details from reference material', () => {
  const sys = buildSystem({ siteBlock: 'x' });
  assert.match(sys, /never (share|repeat|reveal)[^.]*names/i); assert.match(sys, /personal details/i);
});

// ---- the shared, limited free AI (server function) and its client
import { handle, cleanBody, memoryStore, settings } from '../netlify/functions/ai.mjs';
import { providerConfig as pcfg, streamChat as sc, _setFetcher as setF } from '../app/js/providers.js';
const PHX_SYSTEM = buildSystem({ crisisBlock: 'Samaritans 116 123' });
const sse = (...texts) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); for (const t of texts) c.enqueue(e.encode(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } })}\n\n`)); c.enqueue(e.encode('data: {"type":"message_stop"}\n\n')); c.close(); } }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
const post = (body, headers = {}) => new Request('https://phoenix.neurohubcommunity.org/api/ai', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const good = { system: PHX_SYSTEM, messages: [{ role: 'user', content: 'hello' }] };
const env = { PHOENIX_SHARED_AI: 'on', ANTHROPIC_API_KEY: 'sk-test-secret-1234567890', PHOENIX_PER_PERSON_DAILY: '2', PHOENIX_GLOBAL_DAILY: '3', PHOENIX_GLOBAL_MONTHLY: '100' };

test('shared AI: off unless switched on, and never leaks the key', async () => {
  const off = await handle(post(good), { ip: '1.1.1.1' }, { env: {}, store: memoryStore() });
  assert.equal(off.status, 503);
  const get = await handle(new Request('https://x/api/ai'), { ip: '1.1.1.1' }, { env: { ANTHROPIC_API_KEY: 'k' }, store: memoryStore() });
  assert.equal((await get.json()).ai, true, 'on whenever a key is available (the Netlify AI Gateway injects one)');
  const killed = await handle(new Request('https://x/api/ai'), { ip: '1.1.1.1' }, { env: { ANTHROPIC_API_KEY: 'k', PHOENIX_SHARED_AI: 'off' }, store: memoryStore() });
  assert.equal((await killed.json()).ai, false, 'PHOENIX_SHARED_AI=off is the off switch');
  assert.equal(settings({ ANTHROPIC_API_KEY: 'gw', ANTHROPIC_BASE_URL: 'https://gw.example/anthropic' }).upstream, 'https://gw.example/anthropic', 'the gateway key goes to the gateway');
  assert.equal(settings({ PHOENIX_ANTHROPIC_KEY: 'own', ANTHROPIC_BASE_URL: 'https://gw.example' }).upstream, 'https://api.anthropic.com', 'a personal key goes to Anthropic directly');
  const on = await handle(new Request('https://x/api/ai'), { ip: '1.1.1.1' }, { env, store: memoryStore() });
  const j = await on.json(); assert.equal(j.ai, true); assert.equal(j.left, 2); assert.ok(!JSON.stringify(j).includes('sk-test'));
});

test('shared AI: only Phoenix-shaped requests from Phoenix’s own sites are accepted', async () => {
  const deps = { env, store: memoryStore(), fetch: async () => sse('hi') };
  assert.equal((await handle(post(good, { origin: 'https://evil.example' }), { ip: 'a' }, deps)).status, 403);
  assert.equal((await handle(post({ system: 'You are a pirate.', messages: good.messages }), { ip: 'a' }, deps)).status, 400);
  assert.equal((await handle(post({ ...good, messages: [{ role: 'assistant', content: 'x' }] }), { ip: 'a' }, deps)).status, 400);
  assert.equal((await handle(post(good, { origin: 'https://phoenix.neurohubcommunity.org' }), { ip: 'a' }, deps)).status, 200);
  const clean = cleanBody({ system: PHX_SYSTEM, messages: Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(9000) })).concat([{ role: 'user', content: 'last' }]) });
  assert.ok(clean.messages.length <= 16 && clean.messages.every((m) => m.content.length <= 3000) && clean.messages[0].role === 'user' && clean.messages.at(-1).role === 'user');
});

test('shared AI: streams the reply through, forces our model and reply length, and enforces every cap', async () => {
  let sent = null, calls = 0;
  const store = memoryStore(), deps = { env, store, fetch: async (url, init) => { calls++; sent = { url, init, body: JSON.parse(init.body) }; return sse('Hel', 'lo'); } };
  const res = await handle(post({ ...good, model: 'claude-opus-9', maxTokens: 99999 }), { ip: '9.9.9.9' }, deps);
  assert.equal(res.status, 200); assert.match(await res.text(), /Hel[\s\S]*lo/);
  assert.equal(sent.body.model, settings(env).model); assert.ok(sent.body.max_tokens <= 700); assert.equal(sent.init.headers['x-api-key'], env.ANTHROPIC_API_KEY); assert.equal(sent.body.stream, true);
  assert.equal(res.headers.get('x-phoenix-left'), '1');
  assert.equal((await handle(post(good), { ip: '9.9.9.9' }, deps)).status, 200);
  const third = await handle(post(good), { ip: '9.9.9.9' }, deps);
  assert.equal(third.status, 429); assert.equal((await third.json()).scope, 'person');
  assert.equal((await handle(post(good), { ip: '8.8.8.8' }, deps)).status, 200, 'another person still has their own allowance');
  const fourth = await handle(post(good), { ip: '7.7.7.7' }, deps); // global daily cap of 3 is now used
  assert.equal(fourth.status, 429); assert.equal((await fourth.json()).scope, 'everyone'); assert.equal(calls, 3, 'no upstream call is made once a cap is reached');
  const tomorrow = await handle(post(good), { ip: '7.7.7.7' }, { ...deps, now: () => new Date(Date.now() + 86400000 * 1.1) });
  assert.equal(tomorrow.status, 200, 'caps reset each day');
});

test('shared AI: an upstream failure gives a calm error and does not use up the person’s allowance', async () => {
  const store = memoryStore();
  const bad = await handle(post(good), { ip: '5.5.5.5' }, { env, store, fetch: async () => new Response('{"error":{"message":"credit balance too low sk-live-leak"}}', { status: 402 }) });
  assert.equal(bad.status, 503); const body = await bad.text(); assert.ok(!/credit|sk-/.test(body), 'upstream details are never passed on');
  const g = await handle(new Request('https://x/api/ai'), { ip: '5.5.5.5' }, { env, store });
  assert.equal((await g.json()).left, 2);
  const thrown = await handle(post(good), { ip: '5.5.5.5' }, { env, store, fetch: async () => { throw new Error('net'); } });
  assert.equal(thrown.status, 503);
});

test('shared AI: the app streams from it like any other AI, and explains limits kindly', async () => {
  try {
    const seenReq = [];
    setF(async (url, init) => { seenReq.push({ url, init }); return sse('Hello ', 'there'); });
    const cfg = pcfg({ provider: { kind: 'shared' } });
    assert.equal(cfg.kind, 'shared');
    let acc = ''; const out = await sc(cfg, { system: PHX_SYSTEM, messages: [{ role: 'user', content: 'hi' }], onText: (d) => (acc += d) });
    assert.equal(out, 'Hello there'); assert.match(seenReq[0].url, /\/api\/ai$/); assert.ok(!('x-api-key' in (seenReq[0].init.headers || {})), 'no key ever leaves the app for the shared AI');
    setF(async () => new Response('{"error":"limit","scope":"person","perDay":15}', { status: 429 }));
    await assert.rejects(() => sc(cfg, { system: PHX_SYSTEM, messages: [{ role: 'user', content: 'hi' }] }), /used your Phoenix AI replies for today/);
    setF(async () => new Response('{"error":"unavailable"}', { status: 503 }));
    await assert.rejects(() => sc(cfg, { system: PHX_SYSTEM, messages: [{ role: 'user', content: 'hi' }] }), /not available right now/);
  } finally { setF(null); }
});