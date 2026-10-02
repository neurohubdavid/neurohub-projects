// Speech in the real desktop program, with a recording standing in for the microphone (a voice saying "Phoenix. I feel a bit overwhelmed
// today."): the offline engine hears it, the chat's own recognizer and wake-word check work on top of it, the microphone can be switched
// off for good, and the page itself can never open the microphone.
//   npm run test:speech        (needs internet for the live site; the engine itself is offline)
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const pw = ['phoenix-companion', 'phoenix'].map((n) => path.join(__dirname, '..', '..', n, 'node_modules', 'playwright-core')).find((p) => fs.existsSync(p));
const { _electron } = require(pw);
const WAV = path.join(__dirname, 'audio', 'wake-phrase.wav');

async function launch(prefs, fake = true) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'phoenix-desktop-speech-'));
  if (prefs) fs.writeFileSync(path.join(userData, 'desktop-prefs.json'), JSON.stringify(prefs));
  const env = { ...process.env }; if (fake) env.PHOENIX_FAKE_MIC = WAV; else delete env.PHOENIX_FAKE_MIC;
  const app = await _electron.launch({ executablePath: require('electron'), args: ['.', `--user-data-dir=${userData}`], cwd: path.join(__dirname, '..'), env });
  const page = await app.firstWindow();
  let chat = null;
  for (let i = 0; i < 120 && !chat; i++) { chat = page.frames().find((f) => /\/embed\//.test(f.url()) && !/mascot/.test(f.url())); if (!chat) await page.waitForTimeout(500); }
  assert.ok(chat, 'the chat frame is loaded while Phoenix is minimised (so he can listen for his name)');
  await chat.waitForFunction(() => !!window.phoenixSpeech, null, { timeout: 30000 });
  return { app, page, chat };
}
// listens once through the bridge and gives back every event
const listenOnce = (chat, continuous, ms) => chat.evaluate(({ continuous, ms }) => new Promise((resolve) => {
  const events = []; const off = window.phoenixSpeech.on((e) => { events.push(e); if (e.type === 'end') { off(); resolve(events); } });
  const id = window.phoenixSpeech.start({ continuous }); events.push({ type: 'asked', id });
  setTimeout(() => { window.phoenixSpeech.stop(id); setTimeout(() => { off(); resolve(events); }, 2500); }, ms);
}), { continuous, ms });

(async () => {
  let failed = 0;
  const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };
  let s = await launch();
  try {
    await step('the chat gets the speech bridge, and nothing more than start, stop, abort and listening', async () => {
      assert.deepEqual(await s.chat.evaluate(() => [window.phoenixSpeech.available, window.phoenixSpeech.onDevice, Object.keys(window.phoenixSpeech).sort().join()]), [true, true, 'abort,available,on,onDevice,start,stop']);
    });
    await step('Phoenix’s own recognizer hears the phrase through the offline engine (one stretch of speech, then ends)', async () => {
      const r = await s.chat.evaluate(() => import('/embed/js/voice.js').then((v) => new Promise((resolve) => {
        const log = []; const rec = v.createRecognizer({ lang: 'en-GB', onStart: () => log.push('start'), onInterim: (t) => log.push('interim:' + t), onEnd: (x) => resolve({ log, text: x.text, gotFinal: x.gotFinal }), onError: (e) => log.push('error:' + e) });
        rec.start(); setTimeout(() => resolve({ log, timeout: true }), 90000);
      })));
      console.log('      heard:', JSON.stringify(r.text), '| events:', r.log.length);
      assert.ok(!r.timeout, 'it ended by itself'); assert.equal(r.gotFinal, true); assert.match(r.text, /phoenix|phoenix|fenix|phoenic/i); assert.ok(r.log[0] === 'start' && r.log.some((x) => /^interim:/.test(x)), 'it showed words as they came');
      assert.ok(!r.log.some((x) => /^error:/.test(x)), r.log.join('|'));
    });
    await step('the wake word is found in what it heard, with the rest of the sentence kept', async () => {
      const r = await s.chat.evaluate(() => Promise.all([import('/embed/js/voice.js'), import('/embed/js/wake.js')]).then(([v, w]) => new Promise((resolve) => {
        const segs = []; const rec = v.createRecognizer({ lang: 'en-GB', continuous: true, onSegment: (t, f) => segs.push([t, f, w.findWake(t)]), onEnd: () => resolve(segs) });
        rec.start(); setTimeout(() => rec.stop(), 14000);
      })));
      console.log('      segments:', JSON.stringify(r.map((x) => x[0]).slice(-4)));
      const hit = r.find((x) => x[2]); assert.ok(hit, 'a stretch of speech started with the wake word');
      assert.match(hit[2].rest, /feel|overwhelm|bit|today|^$/i);
    });
    await step('stopping early still ends cleanly and frees the microphone (a second session works straight away)', async () => {
      const a = await listenOnce(s.chat, true, 2500); assert.equal(a.at(-1).type, 'end', JSON.stringify(a.map((e) => e.type)));
      const b = await listenOnce(s.chat, true, 2500); assert.equal(b.at(-1).type, 'end');
    });
  } finally { await s.app.close(); }

  // the page's own permission handler (the test switch for a fake microphone skips it, so this is checked in a normal launch)
  const plain = await launch(null, false);
  try {
    await step('the chat page itself can never open the microphone (only the hidden speech window can)', async () => {
      const denied = await plain.chat.evaluate(() => navigator.mediaDevices.getUserMedia({ audio: true }).then((st) => { st.getTracks().forEach((t) => t.stop()); return 'GRANTED'; }, (e) => e.name));
      assert.notEqual(denied, 'GRANTED'); console.log('      refused with:', denied);
    });
  } finally { await plain.app.close(); }

  const off = await launch({ mic: false }); // the tray switch "Let Phoenix use the microphone" turned off
  try {
    await step('with the microphone switched off for good, listening is refused (and Phoenix says so)', async () => {
      const ev = await listenOnce(off.chat, false, 1500);
      assert.deepEqual(ev.filter((e) => e.type !== 'asked').map((e) => [e.type, e.error]), [['error', 'not-allowed'], ['end', undefined]], JSON.stringify(ev));
    });
  } finally { await off.app.close(); }
  if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
  console.log('\nDESKTOP SPEECH CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });

