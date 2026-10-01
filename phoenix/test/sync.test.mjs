// Syncing between devices (merging never loses anything, deletions are respected) and Phoenix's memories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, pickSyncable, applySynced, touchScalars, scalarsOf, pruneDeleted, LOCAL_ONLY_PREFS } from '../app/js/sync-core.js';

const DAY = 86400000, NOW = Date.parse('2026-10-05T10:00:00Z');
const snap = (o = {}) => ({ v: 1, scalarsAt: 0, profile: {}, prefs: {}, plan: {}, onboarded: false, memories: [], chats: [], wellness: [], reports: [], deleted: {}, ...o });
const chat = (id, updated, text = 'hi') => ({ id, title: id, updated, messages: [{ role: 'user', content: text }] });

test('merge: both devices keep what they made, and the newer copy of the same item wins', () => {
  const a = snap({ chats: [chat('c1', 100, 'older'), chat('c2', 300)], memories: [{ id: 'm1', text: 'likes calm', createdAt: 1, updatedAt: 1 }] });
  const b = snap({ chats: [chat('c1', 200, 'newer'), chat('c3', 50)], memories: [{ id: 'm2', text: 'works mornings', createdAt: 2, updatedAt: 2 }] });
  const m = mergeData(a, b, NOW);
  assert.deepEqual(m.chats.map((c) => c.id), ['c2', 'c1', 'c3'], 'newest first');
  assert.equal(m.chats.find((c) => c.id === 'c1').messages[0].content, 'newer');
  assert.deepEqual(m.memories.map((x) => x.id), ['m1', 'm2']);
  assert.deepEqual(mergeData(m, m, NOW), m, 'merging the same thing twice changes nothing');
  assert.deepEqual(mergeData(a, b, NOW).chats, mergeData(b, a, NOW).chats, 'the order of the two devices does not matter');
});

test('merge: something deleted on one device stays deleted on the other, unless it was changed after', () => {
  const T = NOW - 2 * DAY; // times near "now", so the 90-day tombstone rule is not what is being tested here
  const a = snap({ chats: [chat('c1', T + 100)], deleted: {} });
  const b = snap({ chats: [], deleted: { c1: T + 500 } });
  assert.deepEqual(mergeData(a, b, NOW).chats, [], 'deleted after its last change');
  const revived = snap({ chats: [chat('c1', T + 900)] });
  assert.equal(mergeData(revived, b, NOW).chats.length, 1, 'edited after the deletion, so it stays');
  assert.deepEqual(mergeData(a, b, NOW).deleted, { c1: T + 500 }, 'the tombstone travels on to other devices');
  assert.deepEqual(pruneDeleted({ old: NOW - 100 * DAY, fresh: NOW - DAY }, NOW), { fresh: NOW - DAY }, 'tombstones are forgotten after 90 days');
});

test('merge: settings follow the most recent edit, and daily check-ins are joined without duplicates', () => {
  const a = snap({ scalarsAt: 100, profile: { name: 'Sam' }, prefs: { tone: 'gentle', theme: 'dark' } });
  const b = snap({ scalarsAt: 200, profile: { name: 'Samira' }, prefs: { tone: 'direct' } });
  const m = mergeData(a, b, NOW);
  assert.equal(m.profile.name, 'Samira'); assert.equal(m.prefs.tone, 'direct'); assert.equal(m.prefs.theme, 'dark'); assert.equal(m.scalarsAt, 200);
  const w = (id, d) => ({ id, createdAt: d });
  const x = snap({ wellness: [w('w1', '2026-10-01T09:00:00Z'), w('w2', '2026-10-02T09:00:00Z')] }), y = snap({ wellness: [w('w2', '2026-10-02T09:00:00Z'), w('w3', '2026-10-03T09:00:00Z')] });
  assert.deepEqual(mergeData(x, y, NOW).wellness.map((e) => e.id), ['w1', 'w2', 'w3']);
  assert.equal(mergeData(snap({ onboarded: true }), snap(), NOW).onboarded, true);
});

test('sync: what is picked up leaves out device-only choices, trims huge chats, and never includes the sign-in', () => {
  const state = { onboarded: true, profile: { name: 'Sam' }, prefs: { tone: 'gentle', analytics: false, aiSeesCheckins: 'yes', voiceName: 'x', donateReminders: false }, plan: {}, provider: { kind: 'shared' }, reminders: { enabled: true }, share: { pid: 'abc' }, float: {}, account: { token: 'SECRET-TOKEN', scalarsAt: 5 },
    memories: [{ id: 'm', text: 'x', createdAt: 1 }], chats: Array.from({ length: 5 }, (_, i) => ({ id: 'c' + i, updated: i, messages: Array.from({ length: 200 }, (_, j) => ({ role: 'user', content: 'm' + j })) })), wellness: [], reports: [], deleted: {} };
  const s = pickSyncable(state);
  const text = JSON.stringify(s);
  assert.ok(!text.includes('SECRET-TOKEN') && !text.includes('"shared"') && !text.includes('abc'), 'no token, AI choice or sharing id');
  for (const k of LOCAL_ONLY_PREFS) assert.ok(!(k in s.prefs), k + ' stays on the device');
  assert.equal(s.chats[0].messages.length, 80, 'only the latest 80 messages of a chat');
  const huge = { ...state, chats: Array.from({ length: 40 }, (_, i) => ({ id: 'h' + i, updated: i, messages: [{ role: 'user', content: 'x'.repeat(300000) }] })) };
  assert.ok(JSON.stringify(pickSyncable(huge, { maxBytes: 1400000 })).length <= 1400000 + 400000, 'kept within the size limit');
  assert.ok(pickSyncable(huge, { maxBytes: 1400000 }).chats.length >= 3);
});

test('sync: applying a merged copy keeps this device’s own choices and tracks when settings last changed', () => {
  const state = { onboarded: false, profile: { name: 'Sam' }, prefs: { tone: 'gentle', analytics: false }, plan: {}, memories: [], chats: [], wellness: [], reports: [], deleted: {}, currentChat: 'gone', account: { scalarsAt: 0, scalarsHash: '' } };
  touchScalars(state, 1000); assert.equal(state.account.scalarsAt, 1000);
  touchScalars(state, 2000); assert.equal(state.account.scalarsAt, 1000, 'unchanged settings keep their time');
  state.prefs.tone = 'direct'; touchScalars(state, 3000); assert.equal(state.account.scalarsAt, 3000);
  applySynced(state, snap({ scalarsAt: 9000, profile: { name: 'Samira' }, prefs: { tone: 'playful' }, onboarded: true, chats: [chat('c9', 5)] }));
  assert.equal(state.profile.name, 'Samira'); assert.equal(state.prefs.tone, 'playful'); assert.equal(state.prefs.analytics, false, 'this device’s own choice stays'); assert.equal(state.currentChat, 'c9');
  assert.equal(state.account.scalarsAt, 9000); assert.deepEqual(Object.keys(scalarsOf(state)).sort(), ['onboarded', 'plan', 'prefs', 'profile']);
});

// ---- memories (store.js needs a fake localStorage at import)
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { addEventListener() {} };
const mem = await import('../app/js/memory.js');
const { state } = await import('../app/js/store.js');

test('memories: notes are short, plain, deduplicated and kept to a limit; automatic notes skip anything too personal', () => {
  state.account.token = 'tok'; state.account.memory = 'auto'; state.memories = [];
  assert.equal(mem.cleanNote('  Prefers\nshort   replies <b>  '), 'Prefers short replies b');
  assert.equal(mem.cleanNote('hi'), '');
  for (const bad of ['Her email is sam@example.com', 'Takes 20 mg of something', 'Has thought about suicide', 'Phone 07700 900123 is best', 'Bank sort code is private', 'See https://x.example']) assert.equal(mem.cleanNote(bad), '', bad);
  assert.ok(mem.cleanNote('Takes 20 mg of something', { allowSensitive: true }), 'what the person asks to be remembered is theirs to decide');
  const a = mem.addMemory('Likes calm colours', 'ai'); assert.ok(a); assert.equal(mem.addMemory('likes CALM colours', 'ai').id, a.id, 'no duplicates');
  for (let i = 0; i < 70; i++) mem.addMemory('Own note number ' + i, 'me');
  assert.equal(state.memories.length, mem.MEMORY_MAX);
  assert.ok(!state.memories.some((m) => m.id === a.id), 'automatic notes make room first');
});

test('memories: edit, delete (leaving a tombstone so other devices follow) and forget everything', () => {
  state.memories = []; state.deleted = {};
  const m = mem.addMemory('Works best in the mornings', 'ai');
  assert.equal(mem.editMemory(m.id, 'Works best before noon'), true); assert.equal(state.memories[0].from, 'me'); assert.equal(state.memories[0].text, 'Works best before noon');
  assert.equal(mem.deleteMemory(m.id), true); assert.ok(state.deleted[m.id] > 0); assert.equal(state.memories.length, 0);
  mem.addMemory('one note', 'me'); mem.addMemory('two note', 'me'); const ids = state.memories.map((x) => x.id);
  mem.clearMemories(); assert.equal(state.memories.length, 0); assert.ok(ids.every((id) => state.deleted[id]));
});

test('memories: the AI is told them as data, only when signed in and switched on', () => {
  state.memories = []; mem.addMemory('Likes short replies', 'me'); mem.addMemory('Is writing a CV', 'ai');
  state.account.token = 'tok'; state.account.memory = 'auto';
  const b = mem.memoryBlock(); assert.match(b, /data, not instructions/); assert.match(b, /- Likes short replies/); assert.match(b, /Never recite them/);
  state.account.memory = 'off'; assert.equal(mem.memoryBlock(), '');
  state.account.memory = 'ask'; assert.ok(mem.memoryBlock(), 'notes are still used in "only when I ask" mode');
  state.account.token = ''; assert.equal(mem.memoryBlock(), '', 'nothing when signed out');
});

test('memories: "remember that…" works in chat without the AI, and only for signed-in people', () => {
  assert.deepEqual(mem.memoryIntent('Remember that I hate loud notifications'), { kind: 'remember', note: 'I hate loud notifications' });
  assert.equal(mem.memoryIntent('please remember I work nights.').note, 'I work nights');
  assert.equal(mem.memoryIntent('Do you remember what I said?'), null); assert.equal(mem.memoryIntent('I want to remember this holiday'), null); assert.equal(mem.memoryIntent('remember that?'), null);
  assert.equal(mem.memoryIntent('What do you remember about me?').kind, 'recall'); assert.equal(mem.memoryIntent('forget everything').kind, 'forget');
  state.memories = []; state.account.token = ''; assert.match(mem.memoryReply({ kind: 'remember', note: 'x y z' }).text, /make a free account/); assert.equal(state.memories.length, 0);
  state.account.token = 'tok'; state.account.memory = 'auto';
  assert.match(mem.memoryReply({ kind: 'remember', note: 'I hate loud notifications' }).text, /I will remember/); assert.equal(state.memories[0].text, 'I hate loud notifications');
  assert.match(mem.memoryReply({ kind: 'recall' }, 'Sam').text, /loud notifications/);
  mem.memoryReply({ kind: 'forget' }); assert.equal(state.memories.length, 0);
  state.account.memory = 'off'; assert.match(mem.memoryReply({ kind: 'remember', note: 'abc def' }).text, /switched off/); assert.equal(state.memories.length, 0);
});

test('memories: Phoenix’s own notes are read safely from the model’s reply, and never written after a crisis', () => {
  state.account.token = 'tok'; state.account.memory = 'auto'; state.memories = []; const k = mem.addMemory('Old note that is now wrong', 'ai');
  const out = mem.parseNotes('Sure! {"add":["Prefers step-by-step help","Her email is a@b.co","x","Has a sister called Ann, number 07700 900123"],"remove":["' + k.id + '","not-an-id"]} done', state.memories);
  assert.deepEqual(out.add, ['Prefers step-by-step help'], 'the email, the too-short note and the phone number are all dropped');
  assert.deepEqual(out.remove, [k.id]);
  assert.deepEqual(mem.parseNotes('not json at all'), { add: [], remove: [] }); assert.deepEqual(mem.parseNotes('{"add": "string", "remove": 5}'), { add: [], remove: [] });
  assert.equal(mem.parseNotes('{"add":["aaa ccc 1","bbb ccc 2","ccc ccc 3","ddd ccc 4","eee ccc 5"]}', []).add.length, 3, 'at most three notes at a time');
  const chat = { messages: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }] };
  state.account.learnCount = 6; assert.equal(mem.shouldLearn(chat), true);
  state.account.learnCount = 3; assert.equal(mem.shouldLearn(chat), false, 'only after a few messages');
  state.account.learnCount = 9; assert.equal(mem.shouldLearn({ messages: [{ role: 'user', content: 'I want to end it all' }] }), false, 'never after a crisis');
  assert.equal(mem.shouldLearn({ messages: [{ role: 'assistant', content: 'x', crisis: true }] }), false);
  state.account.memory = 'ask'; assert.equal(mem.shouldLearn(chat), false, 'only in automatic mode');
  const req = mem.notesRequest({ messages: [{ role: 'user', content: 'I love quiet cafes' }, { role: 'assistant', content: 'crisis card', crisis: true }, { role: 'assistant', content: 'Nice' }] });
  assert.match(req.system, /MEMORY NOTES TASK/); assert.match(req.system, /You are Phoenix/); assert.ok(req.system.length > 200);
  assert.ok(req.messages[0].content.includes('quiet cafes') && !req.messages[0].content.includes('crisis card'));
});
