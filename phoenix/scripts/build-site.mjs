// Builds the download site into ./site :
//   site/index.html         landing page with download buttons and SHA-256 checksums
//   site/downloads/*.exe    the installers (copied from ./dist)
//   site/app/               the web version (installable as an app on Mac, Linux, Android, iOS, Chromebook)
//   site/_headers           caching and download headers for Netlify
// Run `npm run dist` first, then `node scripts/build-site.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'downloads'), { recursive: true });

// Which installers to publish (the combined x64+arm64 files are twice the size, so they are left out).
const FILES = [
  { file: `Phoenix-Setup-${version}-x64.exe`, label: 'Windows installer', note: 'Most Windows PCs (Intel and AMD). Recommended.', primary: true },
  { file: `Phoenix-Portable-${version}-x64.exe`, label: 'Windows portable', note: 'No install: run it from a folder or a USB stick. Intel and AMD.' },
  { file: `Phoenix-Setup-${version}-arm64.exe`, label: 'Windows installer (ARM)', note: 'Windows on ARM (for example Surface Pro X, Snapdragon laptops).' },
  { file: `Phoenix-Linux-${version}-x64.tar.gz`, label: 'Linux (experimental)', note: 'Unpack it and run the "phoenix" file inside. We have not been able to test this build on Linux, so please tell us if it does not work. If it refuses to start, try running it with --no-sandbox.' },
];
const DOWNLOAD_BASE = process.env.DOWNLOAD_BASE ?? `https://github.com/neurohubdavid/neurohub-projects/releases/download/phoenix-v${version}`;
const rows = [];
for (const f of FILES) {
  const src = path.join(root, 'dist', f.file);
  if (!fs.existsSync(src)) { console.warn('missing', f.file); continue; }
  // The installers are served from the GitHub release (free bandwidth), not from Netlify. Set DOWNLOAD_BASE="" to serve them locally.
  if (!DOWNLOAD_BASE) fs.copyFileSync(src, path.join(site, 'downloads', f.file));
  const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  rows.push({ ...f, hash, mb: (fs.statSync(src).size / 1048576).toFixed(0) });
}

// The web version.
fs.cpSync(path.join(root, 'app'), path.join(site, 'app'), { recursive: true });
fs.rmSync(path.join(site, 'app', 'js', 'package.json'), { force: true });
// shared brand assets for the landing page
fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
fs.cpSync(path.join(root, 'app', 'fonts'), path.join(site, 'assets', 'fonts'), { recursive: true });
fs.copyFileSync(path.join(root, 'app', 'icons', 'icon-512.png'), path.join(site, 'assets', 'icon-512.png'));
fs.copyFileSync(path.join(root, 'app', 'icons', 'icon-192.png'), path.join(site, 'favicon.png'));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const downloads = rows.map((r) => `
      <div class="card dl${r.primary ? ' primary' : ''}">
        <div>
          <h3>${esc(r.label)}</h3>
          <p>${esc(r.note)}</p>
          <details><summary>SHA-256 checksum</summary><code>${r.hash}</code></details>
        </div>
        <a class="btn ${r.primary ? 'btn-primary' : ''}" href="${DOWNLOAD_BASE ? DOWNLOAD_BASE + '/' : 'downloads/'}${esc(r.file)}" rel="noopener">Download · ${r.mb} MB</a>
      </div>`).join('\n');

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Phoenix, a neuro-affirming AI assistant: download</title>
<meta name="description" content="Phoenix is a free, private, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people. Download it for Windows, or use it in your browser. Bring your own AI, keep your data on your device.">
<link rel="icon" href="favicon.png">
<meta name="theme-color" content="#a66bff">
<style>
@font-face{font-family:'Atkinson Hyperlegible';font-weight:400;font-display:swap;src:url(assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Atkinson Hyperlegible';font-weight:700;font-display:swap;src:url(assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Lilita One';font-weight:400;font-display:swap;src:url(assets/fonts/lilita-one-latin-400-normal.woff2) format('woff2')}
:root{--bg:#fffbf2;--card:#fff;--text:#16121f;--muted:#55506b;--border:#16121f;--accent:#a66bff;--lime:#b8f557;--link:#6d35d6;--warn:#fff3d1}
@media (prefers-color-scheme:dark){:root{--bg:#120f1c;--card:#1d1833;--text:#f4f0ff;--muted:#bdb5d6;--border:#cdbdff;--accent:#b98aff;--link:#cdb6ff;--warn:#3a300f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:1.06rem/1.65 'Atkinson Hyperlegible',system-ui,sans-serif}
main{max-width:52rem;margin:0 auto;padding:1.5rem 1rem 4rem}
h1,h2,h3{font-family:'Lilita One','Atkinson Hyperlegible',sans-serif;font-weight:400;line-height:1.15}
h1{font-size:clamp(2.1rem,7vw,3.4rem);margin:.3em 0}h2{font-size:1.7rem;margin:2em 0 .5em}h3{margin:0 0 .3em;font-size:1.25rem}
a{color:var(--link);text-underline-offset:3px}:focus-visible{outline:3px solid var(--link);outline-offset:3px;border-radius:6px}
.hero{display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}.hero img{width:9rem;height:9rem;border-radius:1.5rem}
.card{background:var(--card);border:2.5px solid var(--border);border-radius:16px;box-shadow:4px 4px 0 var(--border);padding:1.1rem 1.25rem;margin:1rem 0}
.dl{display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.dl p{margin:.2em 0;color:var(--muted)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.7em 1.4em;border:2.5px solid var(--border);border-radius:999px;background:var(--card);color:var(--text);font-weight:700;text-decoration:none;box-shadow:3px 3px 0 var(--border)}
.btn:hover{transform:translate(-1px,-1px)}.btn-primary{background:var(--lime);color:#16121f}
code{font:.82rem ui-monospace,Consolas,monospace;word-break:break-all;display:block;margin-top:.4rem}summary{cursor:pointer;color:var(--muted);font-size:.92rem}
.notice{background:var(--warn);border:2px solid var(--border);border-radius:10px;padding:.8rem 1rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}.grid .card{margin:0}
.muted{color:var(--muted)}footer{margin-top:3rem;color:var(--muted);font-size:.92rem}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>
<main>
  <div class="hero">
    <img src="assets/icon-512.png" alt="The Phoenix logo: a colourful phoenix">
    <div>
      <p class="muted" style="margin:0">NeuroHub Community</p>
      <h1>Phoenix</h1>
      <p style="font-size:1.25rem;margin:0">A free, private, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people.</p>
    </div>
  </div>

  <h2 id="download">Download</h2>
  <p>Version ${esc(version)}. Free, no account, no ads, no tracking.</p>
${downloads}
  <div class="card dl">
    <div><h3>Use it in your browser</h3><p>Works on Mac, Linux, Chromebook, Android and iPhone. Open it, then use your browser's “Install” or “Add to Home Screen” option to keep it like an app.</p></div>
    <a class="btn" href="app/">Open the web version</a>
  </div>
  <div class="notice"><strong>Windows shows a warning?</strong> These early builds are not yet code-signed, so Windows SmartScreen may say “Windows protected your PC”. Choose <strong>More info</strong>, then <strong>Run anyway</strong>. You can check the file is genuine by comparing its SHA-256 checksum (above) with the one you get from PowerShell: <code>Get-FileHash .\\Phoenix-Setup-${esc(version)}-x64.exe</code></div>

  <h2>What it is</h2>
  <div class="grid">
    <div class="card"><h3>Neuro-affirming</h3><p>Built on the ideas in David Gray-Hammond's books. It treats neurodivergence as difference, not deficit. It never tells you to mask more, comply, or “try harder”.</p></div>
    <div class="card"><h3>Bring your own AI</h3><p>Free and private on your own computer (Ollama), a free online tier (Gemini, Groq…), or your own paid key. If you use a paid key, <strong>you pay your provider directly</strong>. Phoenix takes nothing and can enforce a daily cap you set.</p></div>
    <div class="card"><h3>Works with no AI</h3><p>A built-in helper and a Toolkit (breathing, grounding, sensory reset, energy check-ins, focus timer, task breaker, scripts, support plan) work offline.</p></div>
    <div class="card"><h3>Accessibility built in</h3><p>Choose your font (including Lexend and OpenDyslexic), text size, line, letter and word spacing, light, dark, calm or high-contrast colours, and the speech voice, speed and pitch. Press Alt + A or the “Aa” button any time.</p></div>
    <div class="card"><h3>Knows NeuroHub</h3><p>It can draw on articles from neurohubcommunity.org and link them, so you can read more.</p></div>
  </div>

  <h2>Your data stays yours</h2>
  <p>Phoenix has no server and no account. On Windows your chats, check-ins and settings are saved as a file in your own app-data folder, with a daily backup kept for a week. They survive updates and uninstalling. You can download a backup, restore one, or delete everything from Settings. If you use an online AI, only the messages you send (and a few relevant passages from neurohubcommunity.org) go to that provider. With Ollama, nothing leaves your computer.</p>

  <h2>Safety</h2>
  <p>Phoenix is a computer program. It is not a therapist, doctor or crisis service, and it cannot diagnose. The red <strong>Help</strong> button is always visible and shows helplines and emergency numbers for your country (checked against each provider's own site on 29 September 2026). If you are in danger, call your local emergency number.</p>

  <h2>Read more</h2>
  <p><a href="https://neurohubcommunity.org">neurohubcommunity.org</a> · <a href="https://connect.neurohubcommunity.org/p/join">Join the community</a> · <a href="https://mybook.to/dgh-full-catalogue">David Gray-Hammond's books</a></p>

  <footer>Made by NeuroHub Community. Software is MIT licensed. This page has no analytics or cookies; the host may keep ordinary server logs.</footer>
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(site, 'index.html'), html);

fs.writeFileSync(path.join(site, '_headers'), `/downloads/*
  Content-Type: application/octet-stream
  Content-Disposition: attachment
  Cache-Control: public, max-age=31536000, immutable
/app/*
  Cache-Control: no-cache
/app/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /app/
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
`);
console.log('site built:', rows.length, 'downloads,', (fs.statSync(path.join(site, 'index.html')).size / 1024).toFixed(0), 'KB page');
