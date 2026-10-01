// Draws the icons for the private backend app (so it is easy to tell apart from Phoenix on a phone's home screen):
// the phoenix on a deep purple tile with an "ADMIN" ribbon. Needs Microsoft Edge (via playwright-core).
//   node scripts/make-admin-icons.mjs
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'scripts', 'site-assets', 'admin-icons');
fs.mkdirSync(out, { recursive: true });
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'app', 'icons', 'icon-512.png')).toString('base64');
const page = (size, pad) => `<!doctype html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:#2a1a5e;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center">
<img src="${logo}" style="width:${size * (1 - pad * 2) * 0.88}px;height:${size * (1 - pad * 2) * 0.88}px;margin-top:-${size * 0.04}px;border-radius:${size * 0.12}px">
<div style="position:absolute;left:0;right:0;bottom:${size * pad + size * 0.02}px;text-align:center"><span style="display:inline-block;background:#ffd23a;color:#16121f;border:${Math.max(2, size * 0.012)}px solid #16121f;border-radius:${size}px;padding:${size * 0.012}px ${size * 0.06}px;font:800 ${size * 0.11}px/1.2 system-ui,Segoe UI,Arial,sans-serif;letter-spacing:.08em">ADMIN</span></div></div></body>`;
const browser = await chromium.launch({ channel: 'msedge' });
for (const [name, size, pad] of [['icon-192.png', 192, 0.02], ['icon-512.png', 512, 0.02], ['icon-maskable-512.png', 512, 0.12], ['apple-touch-icon.png', 180, 0.02]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size, pad)); await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, name), omitBackground: false });
  await p.close();
}
await browser.close();
console.log('admin icons made in', out);
