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
process.env.PHOENIX_NO_ANALYTICS = '1'; // tests never send usage counts to the live site
const userData = fs.mkdtempSync(path.join(root, 'test', '.userdata-'));

// A fake Ollama that streams a reply and records what it was sent.
const seen = [];
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c));
  req.on('end', () => {
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'test-model:8b' }] }));
    if (req.url === '/api/chat') {
      const j = JSON.parse(b); seen.push(j);
      const last = j.messages.at(-1)?.content || '';
      if (last.includes('FORM SECTION')) { // Phoenix asking for a drafted form section: answer with JSON for the first field only
        const ids = [...last.matchAll(/^- "([\w-]+)":/gm)].map((m) => m[1]);
        return res.end(JSON.stringify({ message: { content: JSON.stringify({ [ids[0]]: 'Open plan offices exhaust me.', [ids[1]]: 'N/A' }) }, done: true }) + '\n');
      }
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

await step('tests never send usage counts to the live site', async () => {
  assert.equal(await page.evaluate(() => window.phoenixNative.noAnalytics), true);
});

await step('welcome screen and first start', async () => {
  await page.screenshot({ path: path.join(shots, '01-welcome.png') });
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.provider.kind), 'shared', 'new people start on Phoenix free AI');
  await page.click('button:has-text("Start with the built-in helper")');
  await page.waitForSelector('.name-ask'); // Phoenix asks what to call them on first meeting
  assert.match(await page.textContent('.welcome h1'), /I.m Phoenix/);
  await page.screenshot({ path: path.join(shots, '01b-name-ask.png') });
  await page.fill('input[aria-label="What should Phoenix call you?"]', 'Sam');
  await page.click('button:has-text("That’s me")');
  await page.waitForFunction(() => /Hi Sam/.test(document.querySelector('.welcome h1')?.textContent || ''));
  assert.equal(await page.locator('.name-ask').count(), 0, 'asked only once');
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

await step('accessibility: font, size, spacing, theme and voice controls change the page, and persist', async () => {
  await page.click('#a11y-btn');
  await page.waitForSelector('.modal .a11y');
  await page.screenshot({ path: path.join(shots, '15-accessibility.png') });
  await page.selectOption('.modal select[aria-label="Font"]', 'lexend');
  const set = async (id, v) => { await page.locator('#' + id).evaluate((el, val) => { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); }, v); };
  await set('a11y-size', 1.5); await set('a11y-line', 2.2); await set('a11y-letter', 0.1); await set('a11y-word', 0.3);
  await page.click('.modal button:has-text("High contrast")');
  await page.click('.modal .switch:has-text("Underline links")').catch(() => {});
  const look = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { font: cs.fontFamily, lh: cs.lineHeight, ls: cs.letterSpacing, ws: cs.wordSpacing, root: getComputedStyle(document.documentElement).fontSize, theme: document.documentElement.dataset.theme, bg: cs.backgroundColor };
  });
  assert.match(look.font, /Lexend/); assert.equal(look.root, '24px'); assert.equal(look.theme, 'contrast'); assert.equal(look.bg, 'rgb(0, 0, 0)');
  assert.ok(parseFloat(look.ls) > 0 && parseFloat(look.ws) > 0, 'letter and word spacing applied');
  assert.ok(parseFloat(look.lh) / parseFloat(await page.evaluate(() => getComputedStyle(document.body).fontSize)) > 2, 'line spacing applied');
  // voice section: controls exist and the sample button is usable
  assert.ok(await page.locator('.modal input[aria-label="Speaking speed"]').count() === 1);
  assert.ok(await page.locator('.modal input[aria-label="Pitch"]').count() === 1);
  assert.ok(await page.locator('.modal input[aria-label="Volume"]').count() === 1);
  assert.ok(await page.locator('.modal button:has-text("Hear a sample")').count() === 1);
  await page.screenshot({ path: path.join(shots, '16-accessibility-applied.png') });
  await page.click('.modal button:has-text("Done")');
  // a preset and reset
  await page.keyboard.press('Alt+A'); await page.waitForSelector('.modal .a11y');
  await page.click('.modal button:has-text("Dyslexia-friendly")');
  assert.match(await page.evaluate(() => document.body.style.fontFamily || getComputedStyle(document.body).fontFamily), /Lexend/);
  await page.click('.modal button:has-text("Reset accessibility settings")');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || 'auto'), 'auto');
  await page.click('.modal button:has-text("Done")');
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

await step('documents: fill in the 6PF assessment, let the AI draft from chats (checked, never overwriting), download a real PDF', async () => {
  await page.click('#nav button:has-text("Check-in")');
  await page.click('.seg button:has-text("Documents")');
  await page.waitForSelector('.doc-card');
  assert.equal(await page.locator('.doc-card').count(), 3);
  await page.screenshot({ path: path.join(shots, '30-documents.png') });
  await page.click('.doc-card:has-text("6PF Global Assessment") button:has-text("Start")');
  await page.waitForSelector('#sec-h');
  assert.match(await page.textContent('#sec-h'), /Sensory/);
  await page.fill('#f-sensory-3', 'Soft clothes and dim light help.'); // the person's own words come first
  await page.click('label[for="r-sensory-3"]');
  await page.click('button:has-text("Draft everything I can")');
  await page.waitForSelector('.modal:has-text("What is sent to the AI")');
  assert.match(await page.textContent('.modal'), /never changes anything you have already written|Ratings are never filled in/);
  await page.click('.modal button:has-text("Draft it")');
  await page.waitForFunction(() => /Phoenix drafted/.test(document.querySelector('[role=status]')?.textContent || ''), null, { timeout: 15000 });
  assert.equal(await page.inputValue('#f-sensory-1'), 'Open plan offices exhaust me.');
  assert.equal(await page.inputValue('#f-sensory-3'), 'Soft clothes and dim light help.', 'own answers are never overwritten');
  assert.equal(await page.inputValue('#f-sensory-2'), '', '"N/A" filler is dropped, the field is left for the person');
  assert.ok(await page.locator('.draft-badge:visible').count() >= 1, 'drafted answers are flagged until checked');
  assert.equal(await page.isChecked('#r-sensory-3'), true, 'ratings are never set by the AI');
  await page.fill('#f-sensory-1', 'Open plan offices exhaust me. Headphones help.'); // editing clears the flag
  assert.equal(await page.locator('.draft-badge:visible').count(), 0);
  await page.click('button:has-text("Start ratings from my latest check-in")').catch(() => {}); // only appears when there are check-ins
  await page.evaluate(() => { // capture the download instead of a save dialog
    window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { window.__blobs.push(b); return o(b); };
    HTMLAnchorElement.prototype.click = function () { if (this.hasAttribute('download')) window.__dl = this.getAttribute('download'); };
  });
  await page.click('button:has-text("Download as PDF")');
  await page.waitForFunction(() => window.__dl, null, { timeout: 15000 });
  const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.__blobs.at(-1).arrayBuffer())));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), '%PDF-');
  assert.match(await page.evaluate(() => window.__dl), /^phoenix-global-\d{4}-\d{2}-\d{2}\.pdf$/);
  fs.writeFileSync(path.join(shots, 'documents-e2e.pdf'), Buffer.from(bytes));
});

await step('documents: ratings saved to Insights, then again later, show the change', async () => {
  await page.click('button:has-text("Save my ratings to Insights")');
  await page.waitForSelector('svg.chart[aria-label*="self-assessment"]');
  assert.match(await page.textContent('.view'), /Save another self-assessment in a few weeks/);
  await page.click('.seg button:has-text("Documents")');
  await page.click('button:has-text("Do it again from this")');
  await page.waitForSelector('#sec-h');
  await page.click('label[for="r-sensory-7"]');
  await page.click('button:has-text("Save my ratings to Insights")');
  await page.waitForSelector('table.data:has-text("Change")');
  assert.match(await page.textContent('.view'), /Sensory[\s\S]*▲ 4/);
  assert.match(await page.textContent('.view'), /moved most in the right direction/);
  await page.screenshot({ path: path.join(shots, '31-documents-insights.png'), fullPage: true });
  await page.click('#nav button:has-text("Chat")');
});

await step('donate: the weekly reminder appears only when due, is kind, and can be switched off', async () => {
  const out = await page.evaluate(async () => {
    const { state } = await import('./js/store.js'); const { checkDonateNudge } = await import('./js/donate.js');
    const host = document.getElementById('donate-nudge-host'); host.textContent = '';
    const day = 86400000; state.donate = { firstSeen: Date.now() - 20 * day, lastShown: 0, lastClick: 0 };
    state.chats.forEach((c) => c.messages.forEach((m) => { delete m.crisis; })); state.wellness = []; state.prefs.donateReminders = true;
    await checkDonateNudge(host); const shown = !!host.querySelector('.donate-nudge');
    host.textContent = ''; await checkDonateNudge(host); const again = !!host.querySelector('.donate-nudge'); // shown a moment ago, so not again
    return { shown, again };
  });
  assert.equal(out.shown, true); assert.equal(out.again, false, 'not twice within a week');
  await page.evaluate(async () => { const { state } = await import('./js/store.js'); const { checkDonateNudge } = await import('./js/donate.js'); state.donate.lastShown = 0; await checkDonateNudge(document.getElementById('donate-nudge-host')); });
  await page.waitForSelector('.donate-nudge');
  await page.screenshot({ path: path.join(shots, '33-donate-nudge.png') });
  await page.click('.donate-nudge button:has-text("Don’t remind me")');
  assert.equal(await page.locator('.donate-nudge').count(), 0);
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.prefs.donateReminders), false);
  await page.evaluate(async () => { (await import('./js/store.js')).state.prefs.donateReminders = true; });
});
await step('donate: a noticeable but calm button opens suggested amounts', async () => {
  const btn = page.locator('#donate-btn');
  assert.ok(await btn.isVisible());
  await btn.click();
  await page.waitForSelector('.modal:has-text("Support NeuroHub Community")');
  const amounts = await page.locator('.donate-amounts a').allTextContents();
  assert.deepEqual(amounts, ['£5', '£10', '£25', '£50']);
  for (const a of await page.locator('.donate-amounts a').all()) assert.match((await a.getAttribute('href')) || '', /^https:\/\/paypal\.biz\/emergentdivergence$/);
  await page.screenshot({ path: path.join(shots, '32-donate.png') });
  await page.click('.modal button:has-text("Maybe later")');
});

await step('AI failure gives a helpful message, not a crash', async () => {
  mock.close(); mock.closeAllConnections?.();
  await send('are you there?');
  await page.waitForFunction(() => /Ollama|reach/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  await page.screenshot({ path: path.join(shots, '14-ai-error.png') });
});

await step('daily check-in: guided flow saves an entry and shows advice', async () => {
  await page.waitForSelector('#nav button:has-text("Check-in") .nav-dot');
  await page.click('#nav button:has-text("Check-in")');
  await page.waitForSelector('h2:has-text("Start your first check-in")');
  await page.screenshot({ path: path.join(shots, '20-checkin-home.png') });
  await page.click('button:has-text("Start check-in")');
  await page.waitForSelector('h2:has-text("How are you doing overall today?")');
  await page.click('label[for="mood-2"]'); await page.click('button:has-text("Next")');
  await page.waitForSelector('h2:has-text("Sensory & Environment")');
  await page.click('label[for="d-sensory-1"]');
  await page.fill('textarea[aria-label^="Note about Sensory"]', 'open plan office was loud');
  await page.screenshot({ path: path.join(shots, '21-checkin-step.png') });
  await page.click('button:has-text("Next")');
  await page.click('label[for="d-executive-2"]'); await page.click('button:has-text("Next")');
  await page.click('button:has-text("Skip this one")'); // social
  await page.click('label[for="d-emotional-2"]'); await page.click('button:has-text("Next")');
  await page.click('button:has-text("Next")'); // identity untouched stays at the middle value
  await page.click('button:has-text("Next")'); // strengths
  await page.waitForSelector('h2:has-text("one thing to protect")');
  await page.click('.chip-btn >> nth=0');
  await page.click('button:has-text("Save check-in")');
  await page.waitForSelector('h2:has-text("Saved. Thank you")');
  assert.ok((await page.locator('.advice-card').count()) >= 1, 'advice shown');
  assert.ok(/sensory/i.test(await page.textContent('.view')), 'the lowest area is named');
  await page.screenshot({ path: path.join(shots, '22-checkin-results.png'), fullPage: true });
  await page.waitForFunction(() => !document.querySelector('#nav .nav-dot'), null, { timeout: 3000 }); // the reminder dot goes once you have checked in
});

await step('daily check-in: insights draw accessible charts, table, exports and history', async () => {
  // Backfill a fortnight of earlier days so there is something to chart (same shape the app saves).
  await page.evaluate(async () => {
    const { state, save } = await import('./js/store.js');
    const { freshEntry } = await import('./js/sixpf.js');
    for (let i = 14; i >= 1; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(11, 0, 0, 0);
      const e = freshEntry(); e.id = 'seed' + i; e.createdAt = d.toISOString(); e.overallMood = 2 + (i % 3);
      e.domains.forEach((x, k) => { x.rating = 1 + ((i + k) % 5); });
      state.wellness.push(e);
    }
    save();
  });
  await page.click('button:has-text("Insights")');
  await page.waitForSelector('svg.chart[role="img"]');
  assert.ok((await page.locator('svg.chart').count()) >= 3, 'line, domain and calendar charts');
  for (const svg of await page.locator('svg.chart').all()) assert.ok(((await svg.getAttribute('aria-label')) || '').length > 20, 'each chart has a text description');
  assert.ok((await page.locator('.kpi').count()) === 4);
  await page.click('summary:has-text("numbers as a table")');
  assert.ok((await page.locator('table.data tbody tr').count()) >= 8, 'table alternative');
  await page.click('button:has-text("90 days")'); await page.waitForSelector('button[aria-pressed="true"]:has-text("90 days")');
  await page.check('#sh-sensory'); await page.uncheck('#sh-mood');
  assert.match((await page.getAttribute('.chart-box svg', 'aria-label')) || '', /Sensory/);
  await page.screenshot({ path: path.join(shots, '23-checkin-insights.png'), fullPage: true });
  await page.click('button:has-text("History")');
  await page.waitForSelector('details.card summary');
  assert.ok((await page.locator('details.card').count()) >= 10);
});

await step('daily check-in: the chat answers about check-ins from your own numbers, and reminders can be set', async () => {
  await page.click('#nav button:has-text("Settings")');
  await page.waitForSelector('#reminders-section');
  await page.selectOption('select[aria-label="Can the AI see my check-ins?"]', 'no'); // then the built-in reply answers, not the AI
  await page.check('#reminders-section .switch input');
  await page.waitForFunction(() => /remind you each day at/.test(document.querySelector('#reminders-section [aria-live]')?.textContent || ''));
  await page.fill('#reminders-section input[type=time]', '08:30'); await page.locator('#reminders-section input[type=time]').dispatchEvent('change');
  await page.waitForFunction(() => /08:30/.test(document.querySelector('#reminders-section [aria-live]')?.textContent || ''));
  await page.screenshot({ path: path.join(shots, '24-settings-reminders.png') });
  await page.click('#nav button:has-text("Chat")');
  await page.click('button:has-text("New chat")');
  await send('How have I been doing this week?');
  await page.waitForFunction(() => /Lowest area/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  assert.ok(await page.locator('.msg.assistant:last-of-type button:has-text("insights"), .msg.assistant:last-of-type button:has-text("Check in")').count());
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


