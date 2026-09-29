// Helper: renders every page of a PDF to a PNG using pdf.js in a real browser, so PDFs can be looked at.
//   node test/pdf-render.mjs <folder that holds the pdf> <file.pdf> <output prefix>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dir, pdfFile, prefix] = process.argv.slice(2);
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = u.startsWith('/pdf/') ? path.join(dir, u.slice(5)) : path.join(root, u);
  if (u === '/render.html') { s.setHeader('content-type', 'text/html'); return s.end(`<canvas id=c></canvas><script type=module>
import * as pdfjs from '/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
const doc = await pdfjs.getDocument({ url: '/pdf/${pdfFile}' }).promise; window.N = doc.numPages;
window.render = async (n) => { const p = await doc.getPage(n); const v = p.getViewport({ scale: 1.4 }); const c = document.getElementById('c'); c.width = v.width; c.height = v.height; await p.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; return true; };
window.ready = true;</script>`); }
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', /\.m?js$/.test(f) ? 'text/javascript' : 'application/octet-stream'); s.end(fs.readFileSync(f));
}).listen(0);
await new Promise((r) => srv.on('listening', r));
const b = await chromium.launch({ channel: 'msedge' });
const pg = await b.newPage({ viewport: { width: 900, height: 1200 } });
pg.on('pageerror', (e) => console.log('pageerror', e.message));
await pg.goto(`http://localhost:${srv.address().port}/render.html`);
await pg.waitForFunction(() => window.ready, null, { timeout: 20000 });
const n = await pg.evaluate(() => window.N);
for (let i = 1; i <= n; i++) { await pg.evaluate((k) => window.render(k), i); await pg.locator('#c').screenshot({ path: path.join(dir, `${prefix}-${i}.png`) }); }
console.log('pages', n);
await b.close(); srv.close();

