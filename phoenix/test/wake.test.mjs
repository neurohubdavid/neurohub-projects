// Recognising her name at the start of something said (no microphone needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = { addEventListener() {} };
const { findWake } = await import('../app/js/wake.js');

test('wake word: "Phoenix" or "Hey Phoenix" at the start wakes her, and what follows is kept', () => {
  assert.deepEqual(findWake('Phoenix'), { rest: '' });
  assert.deepEqual(findWake('phoenix.'), { rest: '' });
  assert.deepEqual(findWake('Hey Phoenix'), { rest: '' });
  assert.deepEqual(findWake('Hey Phoenix, I feel overwhelmed today'), { rest: 'I feel overwhelmed today' });
  assert.deepEqual(findWake('ok phoenix can you help me start my email'), { rest: 'can you help me start my email' });
  assert.deepEqual(findWake('Hi, Phoenix!'), { rest: '' });
  assert.deepEqual(findWake('Phoenix: what is monotropism?'), { rest: 'what is monotropism?' });
});

test('wake word: common mis-hearings of her name count; her name in the middle of other talk does not', () => {
  for (const s of ['Fenix', 'Phenix help me', 'hey feenix']) assert.ok(findWake(s), s);
  for (const s of ['my friend phoenix is coming over', 'the phoenix is a mythical bird', 'what time is it', 'I live in Phoenix Arizona', 'please ask phoenix', '', 'phoenixes are birds']) assert.equal(findWake(s), null, s);
});
