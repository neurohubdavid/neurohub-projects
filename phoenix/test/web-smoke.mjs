// Loads the built web version (site/) in real Edge over http, checks it boots, persists data, and registers offline support.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(root, rel);
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '/');
assert.match(await page.textContent('h1'), /Phoenix/);
assert.ok((await page.locator('a[href*="/releases/download/phoenix-v"]').count()) >= 3, 'download links point at the GitHub release');
await page.goto(base + '/app/');
await page.waitForSelector('.modal');
await page.click('button:has-text("Start with the built-in helper")');
await page.fill('textarea[aria-label="Message Phoenix"]', 'what is masking?');
await page.click('button:has-text("Send")');
await page.waitForFunction(() => /Masking/.test(document.body.textContent), null, { timeout: 8000 });
await page.waitForFunction(() => navigator.serviceWorker?.controller || navigator.serviceWorker?.ready, null, { timeout: 8000 });
await page.reload();
await page.waitForSelector('.chat-list');
assert.equal(await page.locator('.modal').count(), 0, 'welcome not shown again');
assert.ok((await page.locator('.msg').count()) >= 2, 'chat persisted in the browser');
const persisted = await page.evaluate(() => navigator.storage?.persisted?.());
console.log('storage.persisted():', persisted, '(browsers may decline until the app is installed or bookmarked)');
assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
console.log('WEB SMOKE OK');
await browser.close(); srv.close();
