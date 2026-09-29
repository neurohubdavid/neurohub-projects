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
test('system prompt carries the personâ€™s settings and crisis details', () => {
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


// ---- pay-as-you-go budget (needs a fake localStorage because store.js reads it at import)
test('budget: paid providers are capped and costs are estimated; local ones are free', async () => {
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.window = { addEventListener() {} };
  const s = await import('../app/js/store.js');
  s.state.provider.kind = 'ollama';
  assert.equal(s.isPaidProvider(), false);
  s.state.provider.kind = 'openai'; s.state.provider.openai.baseUrl = 'http://localhost:1234/v1';
  assert.equal(s.isPaidProvider(), false);
  s.state.provider.openai.baseUrl = 'https://api.groq.com/openai/v1';
  assert.equal(s.isPaidProvider(), true);
  s.state.billing.dailyLimit = 2;
  assert.ok(s.checkBudget().ok);
  s.recordUsage(4000, 400); s.recordUsage(4000, 400);
  assert.equal(s.checkBudget().ok, false);
  assert.match(s.checkBudget().message, /limit of 2/);
  assert.equal(s.estimatedCost(), null);
  s.state.billing.inPerM = 1; s.state.billing.outPerM = 2;
  assert.ok(Math.abs(s.estimatedCost() - ((2000 / 1e6) * 1 + (200 / 1e6) * 2)) < 1e-9);
  s.state.provider.kind = 'ollama'; s.recordUsage(9999, 9999);
  assert.equal(s.state.billing.messages, 2, 'free providers are not counted');
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
