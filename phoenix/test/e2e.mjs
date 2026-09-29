// End-to-end test: launches the real desktop app and drives it like a person would.
//   node test/e2e.mjs        (screenshots land in test/shots)
import { _electron as electron } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const userData = fs.mkdtempSync(path.join(root, 'test', '.userdata-'));

// A fake Ollama that streams a reply and records what it was sent.
const seen = [];
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'test-model:1b' }] }));
    if (req.url === '/api/chat') {
      const j = JSON.parse(b); seen.push(j);
      const words = ['That ', 'sounds ', 'like ', 'a ', 'lot. ', 'I ', 'am ', 'here.'];
      let i = 0;
      const t = setInterval(() => {
        if (i < words.length) res.write(JSON.stringify({ message: { content: words[i++] }, done: false }) + '\n');
        else { clearInterval(t); res.end(JSON.stringify({ message: { content: '' }, done: true }) + '\n'); }
      }, 30);
      return;
    }
    res.statusCode = 404; res.end('nope');
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => mock.on('listening', r));
const mockUrl = `http://127.0.0.1:${mock.address().port}`;

const app = await electron.launch({ args: [root, `--user-data-dir=${userData}`], env: { ...process.env, ELECTRON_ENABLE_LOGGING: '0' } });
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.setViewportSize({ width: 1000, height: 800 });
await page.waitForSelector('.modal');

const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n      ', e.message.split('\n').slice(0, 7).join('\n       ')); await page.screenshot({ path: path.join(shots, 'FAIL-' + name.replace(/\W+/g, '-') + '.png') }); failed++; } };
let failed = 0;
const send = async (text) => { await page.fill('textarea[aria-label="Message Phoenix"]', text); await page.click('button:has-text("Send")'); };
const lastMsg = () => page.locator('.msg.assistant').last();

await step('welcome screen and first start', async () => {
  await page.screenshot({ path: path.join(shots, '01-welcome.png') });
  await page.fill('input[aria-label="What should Phoenix call you?"]', 'Sam');
  await page.click('button:has-text("Start with the built-in helper")');
  await page.waitForSelector('.welcome h1');
  assert.match(await page.textContent('.welcome h1'), /Hi Sam/);
  await page.screenshot({ path: path.join(shots, '02-chat-empty.png') });
});

await step('offline helper explains a term from the books', async () => {
  await send('what is monotropism?');
  await page.waitForFunction(() => /attention/i.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 5000 });
  assert.match(await lastMsg().textContent(), /Monotropism/);
});

await step('offline helper: overwhelm gets a low-demand reply with tools', async () => {
  await send('I am so overwhelmed right now');
  await page.waitForSelector('.msg.assistant:last-of-type .msg-actions button');
  assert.match(await lastMsg().textContent(), /do not have to fix anything/);
  await page.screenshot({ path: path.join(shots, '03-chat-overwhelm.png') });
});

await step('crisis message shows vetted helplines and the Help panel opens', async () => {
  await send('I want to die');
  await page.waitForSelector('.msg.crisis');
  const t = await page.locator('.msg.crisis').last().textContent();
  assert.match(t, /glad you told me/);
  assert.match(t, /Samaritans|988|Lifeline|Find A Helpline|Help/);
  await page.screenshot({ path: path.join(shots, '04-crisis.png') });
  await page.click('#help-btn');
  await page.waitForSelector('.modal h2:has-text("Get help now")');
  await page.screenshot({ path: path.join(shots, '05-help.png') });
  await page.keyboard.press('Escape');
});

await step('overdose message gives emergency steps first', async () => {
  await send('my friend took too much and is not breathing');
  await page.waitForSelector('.msg.crisis:has-text("emergency")');
  const t = await page.locator('.msg.crisis').last().textContent();
  assert.match(t, /Call .* now/); assert.match(t, /recovery position/);
});

await step('toolkit: breathing runs and stops', async () => {
  await page.click('#nav button:has-text("Toolkit")');
  await page.screenshot({ path: path.join(shots, '06-toolkit.png') });
  await page.click('.tile:has-text("Breathing")');
  await page.click('button:has-text("Start")');
  await page.waitForFunction(() => /Breathe/.test(document.querySelector('.breath-orb')?.textContent || ''));
  await page.screenshot({ path: path.join(shots, '07-breathing.png') });
  await page.click('button:has-text("Stop")');
});

await step('toolkit: check-in saves and shows advice', async () => {
  await page.click('button.back');
  await page.click('.tile:has-text("Energy check-in")');
  await page.locator('#ci-energy').fill('1'); await page.locator('#ci-sensory').fill('5');
  await page.click('button:has-text("Save check-in")');
  await page.waitForSelector('.notice.good');
  assert.match(await page.textContent('.notice.good'), /sensory/i);
  await page.screenshot({ path: path.join(shots, '08-checkin.png') });
});

await step('toolkit: task breaker (built-in) makes a checklist you can tick', async () => {
  await page.click('button.back');
  await page.click('.tile:has-text("Task breaker")');
  await page.fill('input[aria-label="Task"]', 'reply to the landlord');
  await page.click('button:has-text("Break it down")');
  await page.waitForSelector('.steps li');
  assert.ok((await page.locator('.steps li').count()) >= 4);
  await page.locator('.steps li input').first().check();
  assert.match(await page.textContent('.card .chip'), /1\//);
  await page.screenshot({ path: path.join(shots, '09-tasks.png') });
});

await step('toolkit: focus timer starts', async () => {
  await page.click('button.back');
  await page.click('.tile:has-text("Focus with Phoenix")');
  await page.click('button:has-text("5 min")');
  await page.click('button:has-text("Start")');
  await page.waitForFunction(() => document.querySelector('.timer-face')?.textContent === '04:59' || document.querySelector('.timer-face')?.textContent === '04:58');
  await page.click('button:has-text("Pause")');
});

await step('toolkit: scripts, plan', async () => {
  await page.click('button.back');
  await page.click('.tile:has-text("Scripts and messages")');
  assert.ok((await page.locator('.script').count()) >= 10);
  await page.click('button.back');
  await page.click('.tile:has-text("My support plan")');
  await page.locator('textarea').first().fill('I go quiet and stim more');
  await page.screenshot({ path: path.join(shots, '10-plan.png') });
});

await step('learn: book concepts are searchable', async () => {
  await page.click('#nav button:has-text("Learn")');
  await page.fill('input[type=search]', 'lilypad');
  await page.waitForSelector('.learn-item');
  assert.match(await page.textContent('.learn-item summary'), /Lilypadding/);
  await page.locator('.learn-item summary').first().click();
  await page.screenshot({ path: path.join(shots, '11-learn.png') });
  await page.fill('input[type=search]', 'harm reduction');
  await page.waitForSelector('.learn-item');
  await page.fill('input[type=search]', 'psychosis');
  assert.ok((await page.locator('.learn-item').count()) >= 2);
});

await step('settings: connect a local AI, find models, test', async () => {
  await page.click('#nav button:has-text("Settings")');
  await page.click('.tile:has-text("On this computer")');
  await page.fill('input[aria-label="Ollama address"]', mockUrl);
  await page.locator('input[aria-label="Ollama address"]').dispatchEvent('change');
  await page.click('button:has-text("Find my models")');
  await page.waitForFunction(() => /Found 1 model/.test(document.querySelector('#ai-section .notice[aria-live]')?.textContent || ''));
  await page.click('button:has-text("Test connection")');
  await page.waitForFunction(() => /Connected/.test(document.querySelector('#ai-section .notice[aria-live]')?.textContent || ''));
  await page.screenshot({ path: path.join(shots, '12-settings-ai.png'), fullPage: false });
});

await step('paid options say the user pays their own tokens, with a daily cap', async () => {
  await page.click('.tile:has-text("Claude (Anthropic)")');
  await page.waitForSelector('h3:has-text("You pay for your own tokens")');
  await page.fill('input[aria-label="Daily message limit"]', '5'); await page.locator('input[aria-label="Daily message limit"]').dispatchEvent('change');
  await page.screenshot({ path: path.join(shots, '12b-settings-paid.png'), fullPage: true });
  await page.click('.tile:has-text("On this computer")');
  assert.equal(await page.locator('h3:has-text("You pay for your own tokens")').count(), 0);
});
await step('chat now streams from the AI through the network bridge, with persona sent', async () => {
  await page.click('#nav button:has-text("Chat")');
  await page.click('button:has-text("New chat")');
  await page.fill('textarea[aria-label="Message Phoenix"]', 'I had a rough day at work');
  await page.click('button:has-text("Send")');
  await page.waitForFunction(() => /I am here\./.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  const sys = seen.at(-1).messages[0];
  assert.equal(sys.role, 'system');
  for (const needle of ['Phoenix', 'Monotropism', 'SAFETY', 'Sam', 'never tell anyone to start, stop']) assert.ok(sys.content.includes(needle), 'system prompt missing: ' + needle);
  assert.equal(seen.at(-1).messages.at(-1).content, 'I had a rough day at work');
  await page.screenshot({ path: path.join(shots, '13-chat-ai.png') });
});

await step('crisis with AI on: helplines appear immediately AND the AI still replies', async () => {
  await send('I want to end it all');
  await page.waitForSelector('.msg.crisis');
  await page.waitForFunction(() => /I am here\./.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  assert.ok(seen.at(-1).messages[0].content.includes('SAFETY FLAG'));
});

await step('AI failure gives a helpful message, not a crash', async () => {
  mock.close(); mock.closeAllConnections?.();
  await send('are you there?');
  await page.waitForFunction(() => /Ollama|reach/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  await page.screenshot({ path: path.join(shots, '14-ai-error.png') });
});

await step('data persists across restart', async () => {
  await app.close();
  const app2 = await electron.launch({ args: [root, `--user-data-dir=${userData}`] });
  const p2 = await app2.firstWindow();
  await p2.waitForSelector('.chat-list');
  assert.equal(await p2.locator('.modal').count(), 0, 'welcome should not show again');
  assert.ok((await p2.locator('.msg').count()) > 0, 'chat history restored');
  await p2.click('#nav button:has-text("Toolkit")'); await p2.click('.tile:has-text("Energy check-in")');
  assert.ok((await p2.locator('.bars .bar').count()) >= 1, 'check-in history restored');
  await app2.close();
});

await step('persistence: data lives in a real file and survives wiped browser storage', async () => {
  const file = path.join(userData, 'phoenix-data.json');
  assert.ok(fs.existsSync(file), 'data file exists');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(saved.chats.length > 0 && saved.checkins.length > 0 && saved.profile.name === 'Sam');
  assert.ok(fs.existsSync(path.join(userData, 'backups')), 'daily backup exists');
  fs.rmSync(path.join(userData, 'Local Storage'), { recursive: true, force: true }); // simulate cleared browser data
  const app3 = await electron.launch({ args: [root, `--user-data-dir=${userData}`] });
  const p3 = await app3.firstWindow();
  await p3.waitForSelector('.chat-list');
  assert.equal(await p3.locator('.modal').count(), 0, 'not treated as a first run');
  assert.ok((await p3.locator('.msg').count()) > 0, 'chat history restored from the file');
  await p3.click('#nav button:has-text("Settings")');
  await p3.waitForSelector('code:has-text("phoenix-data.json")');
  // corrupt the file: the app must fall back to the .bak copy rather than lose everything
  await app3.close();
  fs.writeFileSync(file, '{ not json');
  const app4 = await electron.launch({ args: [root, `--user-data-dir=${userData}`] });
  const p4 = await app4.firstWindow();
  await p4.waitForSelector('.chat-list');
  assert.ok((await p4.locator('.msg').count()) > 0, 'recovered from backup after corruption');
  await app4.close();
});

const real = errors.filter((e) => !/GPU|Autofill|net::ERR|Failed to load resource/i.test(e));
if (real.length) { console.log('  console errors:', real.slice(0, 5)); failed++; }
try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* ignore */ }
mock.close();
console.log(failed ? `\n${failed} FAILED` : '\nALL E2E STEPS PASSED');
process.exit(failed ? 1 : 0);


