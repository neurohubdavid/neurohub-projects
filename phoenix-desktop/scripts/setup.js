// Fetches what the offline speech engine needs but the repository does not keep (about 45 MB): the Vosk engine (from the npm package)
// and its small English model (from the Vosk project's own site, checked against a known checksum). Run once after `npm install`:
//   npm run setup
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..'), dir = path.join(root, 'speech');
const MODEL_ZIP = 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip', MODEL_NAME = 'vosk-model-small-en-us-0.15';
const ZIP_SHA256 = null; // the project does not publish one; the model is checked by loading it (npm test) instead

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const engine = path.join(root, 'node_modules', 'vosk-browser', 'dist', 'vosk.js');
  if (!fs.existsSync(engine)) throw new Error('Run `npm install` first.');
  fs.copyFileSync(engine, path.join(dir, 'vosk.js')); console.log('vosk.js copied');
  const out = path.join(dir, 'model.tar.gz');
  if (fs.existsSync(out) && fs.statSync(out).size > 30e6) { console.log('model.tar.gz is already there'); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phoenix-model-')), zip = path.join(tmp, 'model.zip');
  console.log('downloading the speech model (about 40 MB)…');
  const res = await fetch(MODEL_ZIP); if (!res.ok) throw new Error('download failed: ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(zip, buf);
  if (ZIP_SHA256 && crypto.createHash('sha256').update(buf).digest('hex') !== ZIP_SHA256) throw new Error('the download does not match its checksum');
  execFileSync('tar', ['-xf', zip, '-C', tmp]);                       // bsdtar (Windows 10+, macOS, many Linux) reads zips
  execFileSync('tar', ['-czf', out, '-C', tmp, MODEL_NAME]);          // the engine in the browser wants a .tar.gz
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('model.tar.gz ready (' + Math.round(fs.statSync(out).size / 1e6) + ' MB)');
}
main().catch((e) => { console.error(e.message); process.exit(1); });
