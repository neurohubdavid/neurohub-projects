// Makes the social-sharing image (1200x630, used by Google, Facebook, Bluesky, Slack and others) from the raptor mascot.
//   node scripts/make-og.mjs  ->  brand/og-image.png
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.join(root, 'app');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/og.html') { s.setHeader('content-type', 'text/html'); return s.end(`<!doctype html><meta charset=utf-8><link rel=stylesheet href="/css/brand.css"><link rel=stylesheet href="/css/mascot.css">
<style>html,body{margin:0}#og{width:1200px;height:630px;display:flex;align-items:center;gap:56px;padding:0 84px;background:linear-gradient(135deg,#fffbf2 0,#f3edff 60%,#e9ffc4 100%);position:relative;overflow:hidden;font-family:var(--font)}
#og:before{content:'';position:absolute;left:0;right:0;top:0;height:14px;background:linear-gradient(90deg,#9B3FFF,#5B9CF6,#2ED8BE,#F5C842,#F5813A,#FF6EB4)}
#m .ph{--ph-size:380px}#m .ph *{animation:none!important}h1{font-family:var(--display);font-weight:400;font-size:88px;line-height:1;margin:0 0 18px;color:#16121f}
p{font-size:38px;line-height:1.25;margin:0 0 24px;color:#2c2540;font-weight:700}small{display:block;font-size:26px;color:#55506b}.pill{display:inline-block;background:#b8f557;border:4px solid #16121f;border-radius:999px;padding:8px 26px;font-size:30px;font-weight:700;color:#16121f;box-shadow:5px 5px 0 #16121f}</style>
<div id=og><div id=m></div><div><h1>Phoenix</h1><p>A free, neuro-affirming AI assistant for Autistic and ADHD people</p><span class=pill>Install free. No account.</span><small style="margin-top:22px">NeuroHub Community &middot; phoenix.neurohubcommunity.org</small></div></div>
<script type=module>import { phoenixSVG } from '/js/mascot.js'; const m = phoenixSVG(7); document.getElementById('m').append(m); for (const s of ['.ph-aura','.ph-spark','.ph-think-dots']) m.querySelectorAll(s).forEach((n) => n.remove()); await document.fonts.ready; window.ready = true;</script>`); }
  const f = path.join(app, u);
  if (!f.startsWith(app) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); s.end(fs.readFileSync(f));
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const b = await chromium.launch({ channel: 'msedge' });
const pg = await b.newPage({ viewport: { width: 1200, height: 630 } });
await pg.goto(`http://localhost:${srv.address().port}/og.html`);
await pg.waitForFunction(() => window.ready);
fs.mkdirSync(path.join(root, 'brand'), { recursive: true });
fs.writeFileSync(path.join(root, 'brand', 'og-image.png'), await pg.locator('#og').screenshot());
await b.close(); srv.close();
console.log('brand/og-image.png written');
