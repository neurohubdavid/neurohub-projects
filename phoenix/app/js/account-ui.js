// Settings → Account and memories: sign in with an emailed code, see and change what Phoenix remembers, download or delete everything.
// Accounts are optional. Everything in Phoenix works without one.
import { el, modal, toast, announce, bus, download, fmtDate, fmtTime } from './util.js';
import { state, save } from './store.js';
import { accountsEnabled, requestCode, verifyCode, signOut, deleteAccount, exportAccount, syncNow, signedIn } from './account.js';
import { addMemory, editMemory, deleteMemory, clearMemories, memoryMode } from './memory.js';
import { trackFeature } from './analytics.js';

const PENDING = 'phoenix.signin'; // the email asked about on this browser, so a link from the email can finish signing in
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };

export const ERRORS = {
  bad_email: 'That does not look like an email address. Please check it.',
  slow_down: 'That is a lot of codes for now. Please wait a little while and try again.',
  mail_failed: 'We could not send the email just now. Please try again in a few minutes.',
  network: 'Could not reach Phoenix. Please check your internet connection and try again.',
  off: 'Accounts are not available right now.',
  origin: 'Accounts only work on phoenix.neurohubcommunity.org.',
};

/** A sign-in link from the email opens Phoenix with ?code=... Keep the code, tidy the address bar, and head to the account section. */
export function takeCodeFromLink() {
  try {
    const q = new URLSearchParams(location.search), c = (q.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 8) return false;
    sessionStorage.setItem('phoenix.code', c);
    q.delete('code'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    return true;
  } catch { return false; }
}

export function accountSection() {
  const box = el('fieldset', { id: 'account-section', hidden: true }, el('legend', {}, 'Account and memories (optional)'));
  accountsEnabled().then((on) => { if (on) { box.hidden = false; draw(); } });
  const draw = () => { box.querySelectorAll(':scope > :not(legend)').forEach((n) => n.remove()); box.append(signedIn() ? signedInView(draw) : signedOutView(draw)); };
  const redraw = () => { if (!box.hidden && box.isConnected) draw(); };
  bus.on('account', redraw); bus.on('synced', redraw);
  return box;
}

// ---------------------------------------------------------------- not signed in
function signedOutView(draw) {
  const saved = (() => { try { return JSON.parse(lsGet(PENDING) || 'null'); } catch { return null; } })();
  let step = 'email', email = saved?.email || '', haveLinkCode = false; // haveLinkCode: they arrived from the email link, so the code is already in hand
  const wrap = el('div', { class: 'stack' });
  const msg = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const say = (t, bad = false) => { msg.textContent = t || ''; msg.className = 'small' + (bad ? ' notice bad' : ''); if (t) announce(t); };

  const intro = el('div', { class: 'stack' },
    el('p', {}, 'You can use Phoenix fully without an account. If you make one, your chats, daily check-ins, documents and settings follow you to other devices, and Phoenix can remember things about you so you do not have to explain yourself again.'),
    el('details', {}, el('summary', {}, 'What is stored, and who can see it'),
      el('ul', { class: 'small' },
        el('li', {}, 'Your email address is used once, to send you a sign-in code, and is never stored. Only an unreadable fingerprint of it is kept, so nobody can see or recover your address from our records.'),
        el('li', {}, 'Your synced data (chats, check-ins, documents, settings and Phoenix’s notes about you) is stored scrambled with a key only the server holds. NeuroHub staff do not read it, and it is not used for research or sharing.'),
        el('li', {}, 'When you chat, your messages and Phoenix’s notes about you go to Anthropic’s Claude to write a reply, like any Phoenix AI chat. They are not kept by NeuroHub for that.'),
        el('li', {}, 'You can see, edit and delete every note, download everything held, or delete your account and all its data at any time. Deleting is permanent.'),
        el('li', {}, 'Anonymous counts (for example “an account was made”) help NeuroHub run Phoenix. They contain nothing about you.'))));

  const emailIn = el('input', { class: 'input', type: 'email', autocomplete: 'email', inputmode: 'email', 'aria-label': 'Your email address', placeholder: 'you@example.com', value: email, maxlength: '254' });
  const age = el('input', { type: 'checkbox', id: 'acct-age' });
  const askBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Email me a sign-in code');
  const codeIn = el('input', { class: 'input', 'aria-label': 'Sign-in code from your email', autocomplete: 'one-time-code', placeholder: 'ABCD-EFGH', maxlength: '9', style: { maxWidth: '12rem', letterSpacing: '.15em', textTransform: 'uppercase' } });
  const goBtn = el('button', { class: 'btn btn-primary', type: 'button' }, 'Sign in');
  const resend = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Send a new code');
  const change = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Use a different email');

  const emailStep = el('div', { class: 'stack' },
    el('label', { class: 'field' }, 'Your email address', emailIn),
    el('label', { class: 'switch' }, age, el('span', {}, 'I am 18 or over, and I understand what is stored (above).')),
    el('div', { class: 'row-wrap' }, askBtn));
  const codeStep = el('div', { class: 'stack' },
    el('p', { class: 'small', id: 'acct-sent' }),
    el('label', { class: 'field' }, 'Sign-in code', codeIn),
    el('div', { class: 'row-wrap' }, goBtn, resend, change));

  const show = (s) => { step = s; emailStep.hidden = s !== 'email'; codeStep.hidden = s !== 'code'; if (s === 'code') { codeStep.querySelector('#acct-sent').textContent = `We emailed a code to ${email}. It works once and lasts 15 minutes. Check your spam folder if it does not arrive.`; setTimeout(() => codeIn.focus(), 50); } };

  async function ask() {
    email = emailIn.value.trim();
    if (haveLinkCode) { if (!age.checked) return say('Please tick the box first.', true); if (!email) return say('Please type the email address the code was sent to.', true); haveLinkCode = false; show('code'); return finish(false); }
    if (!age.checked) return say('Please tick the box to say you are 18 or over and understand what is stored.', true);
    askBtn.disabled = true; resend.disabled = true; say('Sending…');
    const r = await requestCode(email);
    askBtn.disabled = false; resend.disabled = false;
    if (r.error) return say(ERRORS[r.error] || ERRORS.network, true);
    lsSet(PENDING, JSON.stringify({ email, at: Date.now() }));
    say(''); show('code');
  }
  async function finish(auto = false) {
    const code = codeIn.value.trim(); if (code.replace(/[^A-Za-z0-9]/g, '').length !== 8) return say('The code has 8 letters and numbers, like ABCD-EFGH.', true);
    goBtn.disabled = true; say(auto ? 'Signing you in…' : 'Checking…');
    const r = await verifyCode(email, code);
    goBtn.disabled = false;
    if (r.error) return say(r.expired ? 'That code has expired or has been used. Please ask for a new one.' : r.triesLeft != null ? `That code did not work. ${r.triesLeft} ${r.triesLeft === 1 ? 'try' : 'tries'} left.` : (ERRORS[r.error] || 'That code did not work.'), true);
    lsDel(PENDING); sessionStorage.removeItem('phoenix.code');
    toast(r.isNew ? 'Your account is ready. Your data on this device is now saved to it.' : 'Signed in. Your data is up to date on this device.', { icon: '✅', ms: 4200 });
    bus.emit('account'); draw();
  }
  askBtn.addEventListener('click', ask); resend.addEventListener('click', ask);
  emailIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ask(); } });
  goBtn.addEventListener('click', () => finish(false));
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); finish(false); } });
  change.addEventListener('click', () => { say(''); show('email'); emailIn.focus(); });

  wrap.append(intro, emailStep, codeStep, msg);
  show('email');
  // Opened from the link in the email: fill the code in, and sign in at once if this browser asked for it.
  let linkCode = ''; try { linkCode = sessionStorage.getItem('phoenix.code') || ''; } catch { /* ignore */ }
  if (linkCode) {
    codeIn.value = `${linkCode.slice(0, 4)}-${linkCode.slice(4)}`;
    if (email && saved && Date.now() - saved.at < 20 * 60000) { age.checked = true; show('code'); setTimeout(() => finish(true), 200); }
    else { haveLinkCode = true; show('email'); say('Your code from the link is ready. Enter the email address it was sent to, tick the box, and press the button to continue.'); askBtn.textContent = 'I already have my code'; }
  }
  return wrap;
}

// ---------------------------------------------------------------- signed in
function signedInView(draw) {
  const a = state.account;
  const wrap = el('div', { class: 'stack' });
  const status = el('p', { class: 'small', role: 'status', 'aria-live': 'polite' });
  const synced = () => (a.lastSync ? `Last synced ${fmtDate(a.lastSync, { day: 'numeric', month: 'short' })} at ${fmtTime(a.lastSync)}.` : 'Not synced yet.');
  status.textContent = `Signed in as ${a.email || 'your account'} on this device. ${a.sync ? synced() : 'Syncing is off.'}`;

  const syncBtn = el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { status.textContent = 'Syncing…'; const r = await syncNow(); status.textContent = r.ok ? `Synced. ${synced()}` : r.skipped ? 'Syncing is off.' : 'Could not sync just now. It will try again.'; announce(status.textContent); } }, 'Sync now');
  const syncOn = el('input', { type: 'checkbox', checked: !!a.sync });
  syncOn.addEventListener('change', () => { a.sync = syncOn.checked; save(); trackFeature(a.sync ? 'sync_on' : 'sync_off'); if (a.sync) syncNow(); draw(); });
  wrap.append(status, el('div', { class: 'row-wrap' }, el('label', { class: 'switch' }, syncOn, el('span', {}, 'Keep my chats, check-ins, documents and settings in sync between my devices')), syncBtn),
    el('p', { class: 'muted small' }, 'Signed-in people get more Phoenix AI replies each day.'));

  // memories
  const mode = el('select', { class: 'input', 'aria-label': 'What Phoenix remembers' },
    el('option', { value: 'auto' }, 'Phoenix makes notes from our chats (I can see and change them)'), el('option', { value: 'ask' }, 'Only when I say “remember that…”'), el('option', { value: 'off' }, 'Remember nothing'));
  mode.value = memoryMode() === 'off' ? 'off' : a.memory || 'auto';
  mode.addEventListener('change', () => { a.memory = mode.value; save(); announce('Saved'); draw(); });
  const list = el('ul', { class: 'memlist', 'aria-label': 'Things Phoenix remembers about you' });
  const drawList = () => {
    list.textContent = '';
    const ms = state.memories || [];
    if (!ms.length) list.append(el('li', { class: 'muted small' }, 'Nothing yet. Tell Phoenix “remember that…” in the chat, or add a note below.'));
    for (const m of [...ms].reverse()) {
      const row = el('li', { class: 'memrow' });
      const show = () => { row.textContent = ''; row.append(el('span', { class: 'memtext' }, m.text, el('span', { class: 'muted small' }, m.from === 'ai' ? '  · Phoenix’s note' : '  · yours')), el('span', { class: 'row-wrap' }, el('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': `Edit: ${m.text}`, onclick: edit }, 'Edit'), el('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': `Delete: ${m.text}`, onclick: () => { deleteMemory(m.id); trackFeature('memory_deleted'); announce('Deleted'); drawList(); } }, 'Delete'))); };
      const edit = () => { row.textContent = ''; const i = el('input', { class: 'input', maxlength: '200', 'aria-label': 'Edit this note', value: m.text }); const done = () => { if (editMemory(m.id, i.value)) trackFeature('memory_edited'); drawList(); }; i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(); } if (e.key === 'Escape') drawList(); }); row.append(i, el('span', { class: 'row-wrap' }, el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: done }, 'Save'), el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: drawList }, 'Cancel'))); i.focus(); };
      show(); list.append(row);
    }
  };
  const addIn = el('input', { class: 'input', maxlength: '200', 'aria-label': 'Add something for Phoenix to remember', placeholder: 'e.g. I like short replies, and gentle reminders' });
  const addNote = () => { const m = addMemory(addIn.value, 'me'); if (m) { trackFeature('memory_added'); addIn.value = ''; announce('Added'); drawList(); } else announce('Could not add that'); };
  addIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
  drawList();
  wrap.append(el('h3', {}, 'What Phoenix remembers'),
    el('p', { class: 'muted small' }, 'Short notes that help Phoenix support you without you repeating yourself. They are given to Phoenix AI as background when you chat. Phoenix does not write notes after a crisis conversation, and never keeps whole conversations as notes.'),
    el('label', { class: 'field' }, 'How Phoenix remembers', mode), list,
    el('div', { class: 'composer-row' }, addIn, el('button', { class: 'btn btn-sm', type: 'button', onclick: addNote }, 'Add')),
    el('div', { class: 'row-wrap' }, el('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => modal({ title: 'Forget everything?', body: el('p', {}, 'Phoenix will delete every note it keeps about you, here and on your other devices. Your chats and check-ins stay.'), actions: [{ label: 'Keep them' }, { label: 'Forget everything', class: 'btn-danger', onclick: () => { clearMemories(); drawList(); toast('Forgotten.', { icon: '✓' }); } }] }) }, 'Forget everything')));

  // your data, signing out, deleting
  const out = el('div', { class: 'row-wrap' },
    el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { const t = await exportAccount(); if (t) download(`phoenix-account-data-${new Date().toISOString().slice(0, 10)}.json`, t, 'application/json'); else toast('Could not download just now.', { icon: '⚠️' }); } }, 'Download everything held for my account'),
    el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await signOut(); toast('Signed out. Your data is still on this device.', { icon: '👋' }); draw(); } }, 'Sign out'),
    el('button', { class: 'btn btn-sm', type: 'button', onclick: async () => { await signOut({ everywhere: true }); toast('Signed out on every device.', { icon: '👋' }); draw(); } }, 'Sign out everywhere'),
    el('button', { class: 'btn btn-sm btn-danger', type: 'button', onclick: () => modal({ title: 'Delete your account?', body: el('div', { class: 'stack' }, el('p', {}, 'This permanently deletes your account and everything stored for it: your synced chats, check-ins, documents, settings and Phoenix’s notes about you, on every device’s account copy.'), el('p', { class: 'small' }, 'The data already on this device stays here until you delete it in Settings, Your data. You can make a new account any time.')), actions: [{ label: 'Keep my account' }, { label: 'Delete my account', class: 'btn-danger', onclick: async () => { const r = await deleteAccount(); toast(r.ok ? 'Your account and its data have been deleted.' : 'Could not delete just now. Please try again.', { icon: r.ok ? '✓' : '⚠️', ms: 4200 }); draw(); } }] }) }, 'Delete my account and its data'));
  wrap.append(el('h3', {}, 'Your account'), out);
  return wrap;
}
