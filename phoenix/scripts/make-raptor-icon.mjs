// Draws the app icon from the raptor-style Phoenix mascot (app/js/mascot.js), so the icon, the logo and the assistant are one bird.
//   node scripts/make-raptor-icon.mjs      then      node scripts/make-icons.mjs
// Renders the real mascot SVG in a browser onto a lime rounded square: app/icons/icon-512.png and build/icon.png.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/icon.html') { s.setHeader('content-type', 'text/html'); return s.end(`<!doctype html><meta charset=utf-8><link rel=stylesheet href="/css/brand.css"><link rel=stylesheet href="/css/mascot.css">
<style>html,body{margin:0;background:transparent}#tile{width:512px;height:512px;border-radius:112px;background:radial-gradient(circle at 50% 42%,#d7ff8a 0,#b8f557 62%,#9bdc3c 100%);display:flex;align-items:center;justify-content:center;overflow:hidden}
#tile .ph{--ph-size:430px;transform:translateY(6px)}#tile .ph *{animation:none!important}</style>
<div id=tile></div><script type=module>
import { phoenixSVG } from '/js/mascot.js';
const m = phoenixSVG(7); m.dataset.state = 'idle'; document.getElementById('tile').append(m);
for (const sel of ['.ph-aura', '.ph-spark', '.ph-think-dots']) m.querySelectorAll(sel).forEach((n) => n.remove());
await document.fonts.ready; window.ready = true;</script>`); }
  const f = path.join(app, u);
  if (!f.startsWith(app) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); s.end(fs.readFileSync(f));
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const b = await chromium.launch({ channel: 'msedge' });
const pg = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
await pg.goto(`http://localhost:${srv.address().port}/icon.html`);
await pg.waitForFunction(() => window.ready);
const png = await pg.locator('#tile').screenshot({ omitBackground: true });
fs.writeFileSync(path.join(app, 'icons', 'icon-512.png'), png);
fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png);
await b.close(); srv.close();
console.log('icon-512.png and build/icon.png written from the raptor mascot');
