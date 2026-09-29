// Takes the store-style screenshots listed in the PWA manifest (wide and narrow) from the real app, in real Edge.
//   node scripts/make-screenshots.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'app');
const out = path.join(root, 'screenshots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(root, rel);
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch({ channel: 'msedge' });

async function shoot(name, viewport, prep) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForSelector('.modal');
  await page.fill('input[aria-label="What should Phoenix call you?"]', 'Sam');
  await page.click('button:has-text("Start with the built-in helper")');
  await page.waitForSelector('.welcome h1');
  await prep(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, name) });
  await ctx.close();
}
const chat = async (page) => {
  await page.fill('textarea[aria-label="Message Phoenix"]', 'I am so overwhelmed right now');
  await page.click('button:has-text("Send")');
  await page.waitForSelector('.msg.assistant .msg-actions button');
};
await shoot('wide-chat.png', { width: 1280, height: 720 }, chat);
await shoot('wide-toolkit.png', { width: 1280, height: 720 }, async (p) => { await p.click('#nav button:has-text("Toolkit")'); await p.waitForSelector('.tile'); });
await shoot('narrow-chat.png', { width: 750, height: 1334 }, chat);
await shoot('narrow-toolkit.png', { width: 750, height: 1334 }, async (p) => { await p.click('#nav button:has-text("Toolkit")'); await p.waitForSelector('.tile'); });
await browser.close(); srv.close();
console.log('screenshots:', fs.readdirSync(out).join(', '));
