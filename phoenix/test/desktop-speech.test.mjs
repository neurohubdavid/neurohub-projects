// Speech in the Phoenix desktop program: the offline engine's events look like the browser's SpeechRecognition to the rest of Phoenix,
// so the mic button, spoken conversations and the "Phoenix" wake word work the same.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// a stand-in for the bridge the desktop program provides (window.phoenixSpeech)
const sent = [], listeners = new Set();
globalThis.phoenixSpeech = {
  available: true, onDevice: true,
  start: (o) => { sent.push(['start', o]); return 'id1'; }, stop: (id) => sent.push(['stop', id]), abort: (id) => sent.push(['abort', id]),
  on: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
};
const emit = (ev) => { for (const l of [...listeners]) l(ev); };
const { desktopRecognitionClass, desktopSpeechAvailable } = await import('../app/js/desktop-speech.js');
const { createRecognizer, voiceSupport } = await import('../app/js/voice.js');
const { findWake } = await import('../app/js/wake.js').catch(() => ({ findWake: null }));

test('the desktop engine is used, and reported as on-device, when the bridge exists', () => {
  assert.equal(desktopSpeechAvailable(), true); assert.equal(voiceSupport.stt, true); assert.equal(voiceSupport.onDevice, true);
  assert.equal(typeof desktopRecognitionClass(), 'function');
});

test('events become browser-style results: interim text, then finished stretches with resultIndex, then end', () => {
  const R = desktopRecognitionClass(); const r = new R(); r.continuous = true; const seen = [];
  r.onstart = () => seen.push('start'); r.onend = () => seen.push('end');
  r.onresult = (e) => seen.push([e.resultIndex, [...e.results].map((x) => [x[0].transcript, x.isFinal])]);
  r.start(); assert.deepEqual(sent.at(-1), ['start', { continuous: true }]);
  emit({ id: 'other', type: 'partial', text: 'ignored: another session' });
  emit({ id: 'id1', type: 'start' }); emit({ id: 'id1', type: 'partial', text: 'phoenix i feel' });
  emit({ id: 'id1', type: 'final', text: 'phoenix i feel overwhelmed' }); emit({ id: 'id1', type: 'partial', text: 'and tired' }); emit({ id: 'id1', type: 'final', text: 'and tired' });
  emit({ id: 'id1', type: 'end' });
  assert.deepEqual(seen, ['start', [0, [['phoenix i feel', false]]], [0, [['phoenix i feel overwhelmed', true]]], [1, [['phoenix i feel overwhelmed', true], [' and tired', false]]], [1, [['phoenix i feel overwhelmed', true], [' and tired', true]]], 'end']);
  assert.equal(listeners.size, 0, 'it stops listening to the bridge once ended');
  r.start(); assert.throws(() => r.start(), /already started/); r.abort();
});

test('Phoenix’s own recognizer works on top of it: interim text, the final text, and a clean end; errors keep the browser’s names', () => {
  const log = []; let off;
  const rec = createRecognizer({ lang: 'en-GB', onStart: () => log.push('start'), onInterim: (t) => log.push('interim:' + t), onEnd: (x) => log.push(['end', x.text, x.gotFinal]), onError: (e) => log.push('error:' + e) });
  rec.start(); emit({ id: 'id1', type: 'start' }); emit({ id: 'id1', type: 'partial', text: 'hello there' }); emit({ id: 'id1', type: 'final', text: 'hello there phoenix' }); emit({ id: 'id1', type: 'end' });
  assert.deepEqual(log, ['start', 'interim:hello there', 'interim:hello there phoenix', ['end', 'hello there phoenix', true]]);
  log.length = 0; const r2 = createRecognizer({ onError: (e) => log.push('error:' + e), onEnd: (x) => log.push(['end', x.gotFinal]) }); r2.start();
  emit({ id: 'id1', type: 'error', error: 'no-speech' }); emit({ id: 'id1', type: 'end' });
  assert.deepEqual(log, ['error:no-speech', ['end', false]]);
  log.length = 0; const r3 = createRecognizer({ onError: (e) => log.push('error:' + e) }); r3.start(); emit({ id: 'id1', type: 'error', error: 'not-allowed' }); emit({ id: 'id1', type: 'error', error: 'engine' });
  assert.deepEqual(log, ['error:not-allowed', 'error:service-not-allowed']);
});

test('the wake word is found in what the desktop engine hears, and not in the middle of other talk', () => {
  if (!findWake) return; // wake.js needs a browser; its own tests cover this
  assert.deepEqual(findWake('phoenix i feel overwhelmed'), { rest: 'i feel overwhelmed' }); assert.deepEqual(findWake('hey phoenix'), { rest: '' }); assert.equal(findWake('i told phoenix about it yesterday'), null);
});
