// The packaged program (what people download) can listen too: the engine files are found outside the archive and the recording is heard.
//   node test/packaged.js [path to Phoenix Desktop.exe]     (default: the arm64 or x64 build in dist/ that matches this PC)
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');
const pw = ['phoenix-companion', 'phoenix'].map((n) => path.join(__dirname, '..', '..', n, 'node_modules', 'playwright-core')).find((p) => fs.existsSync(p));
const { _electron } = require(pw);
const exe = process.argv[2] || path.join(__dirname, '..', 'dist', process.arch === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked', 'Phoenix Desktop.exe');
(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'phoenix-packaged-'));
  const app = await _electron.launch({ executablePath: exe, args: [`--user-data-dir=${userData}`], env: { ...process.env, PHOENIX_FAKE_MIC: path.join(__dirname, 'audio', 'wake-phrase.wav') } });
  try {
    const page = await app.firstWindow(); let chat = null;
    for (let i = 0; i < 120 && !chat; i++) { chat = page.frames().find((f) => /\/embed\//.test(f.url()) && !/mascot/.test(f.url())); if (!chat) await page.waitForTimeout(500); }
    assert.ok(chat, 'chat frame'); await chat.waitForFunction(() => !!window.phoenixSpeech, null, { timeout: 30000 });
    const ev = await chat.evaluate(() => new Promise((resolve) => { const out = []; window.phoenixSpeech.on((e) => { out.push(e); if (e.type === 'end') resolve(out); }); window.phoenixSpeech.start({ continuous: false }); setTimeout(() => resolve(out), 90000); }));
    const text = ev.filter((e) => e.type === 'final').map((e) => e.text).join(' ');
    console.log('  packaged program heard:', JSON.stringify(text), '| errors:', JSON.stringify(ev.filter((e) => e.type === 'error')));
    assert.match(text, /phoenix|fenix|phoenic/i); assert.equal(ev.at(-1).type, 'end');
    console.log('\nPACKAGED SPEECH CHECK PASSED');
  } finally { await app.close(); }
})().catch((e) => { console.error(e.message); process.exit(1); });
