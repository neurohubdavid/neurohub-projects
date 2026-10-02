// Settings: about me, how Phoenix talks, connecting an AI, appearance, your data.
import { el, toast, modal, download, dayKey, fmtDate, bus } from './util.js';
import { trackFeature } from './analytics.js';
import { state, save, flush, resetAll, exportData, importData } from './store.js';
import { sharedStatus } from './providers.js';
import { loadCrisis } from './crisis.js';
import { loadSite, siteInfo, refreshSite } from './site.js';
import { applyLook, buildAccessibilityPanel } from './accessibility.js';
import { installPanel } from './install.js';
import { openDonate } from './donate.js';
import { startSharing, stopSharing } from './share.js';
import { floatSupported, openFloat, setNudges } from './float.js';
import { accountSection } from './account-ui.js';
import { wakeSupported, wakeEnabled, wakeListening, enableWake, disableWake, isInstalled } from './wake.js';
import { voiceAllowed } from './voice-gate.js';
import { catalogSize, loadCatalog } from './catalog.js';
import { ph, PHOENIX_SETS, PERSON_PRONOUNS, cleanPronouns } from './pronouns.js';
import { voiceSupport } from './voice.js';
import { notifSupport, setReminder, testReminder, downloadIcs } from './reminders.js';

const NEUROTYPES = ['Autistic', 'ADHD', 'AuDHD', 'Dyslexic', 'Dyspraxic', 'Dyscalculic', 'Tourettic', 'OCD', 'Voice-hearer', 'Exploring / not sure', 'Multiply neurodivergent'];

export { applyLook }; // moved to accessibility.js, re-exported so existing imports keep working

const seg = (options, get, set, label) => {
  const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  const draw = () => { wrap.textContent = ''; for (const [v, l] of options) wrap.append(el('button', { 'aria-pressed': String(get() === v), onclick: () => { set(v); save(); draw(); } }, l)); };
  draw(); return wrap;
};
const toggle = (label, get, set, hint) => {
  const input = el('input', { type: 'checkbox', checked: !!get() });
  input.addEventListener('change', () => { set(input.checked); save(); });
  return el('div', {}, el('label', { class: 'switch' }, input, el('span', {}, label)), hint ? el('div', { class: 'muted small' }, hint) : null);
};

export function mountSettings(container, { focus } = {}) {
  container.textContent = '';
  container.classList.remove('chat-view');
  const root = el('div', { class: 'stack' });
  container.append(el('div', { class: 'view-title' }, el('h1', {}, 'Settings')), root);

  // ---------------------------------------------------- about me
  const name = el('input', { class: 'input', value: state.profile.name, maxlength: '40', autocomplete: 'off' });
  name.addEventListener('input', () => { state.profile.name = name.value.trim(); save(); });
  const about = el('textarea', { class: 'input', rows: '4', maxlength: '900', placeholder: 'For example: I have ADHD and get overwhelmed by long replies. I like clear steps. Please never suggest I “just try harder”.' });
  about.value = state.profile.about; about.addEventListener('input', () => { state.profile.about = about.value; save(); });
  const tags = el('div', { class: 'tags', role: 'group', 'aria-label': 'How I describe myself' }, NEUROTYPES.map((t) => {
    const b = el('button', { class: 'tag', 'aria-pressed': String(state.profile.neurotypes.includes(t)), onclick: () => {
      const s = new Set(state.profile.neurotypes); s.has(t) ? s.delete(t) : s.add(t); state.profile.neurotypes = [...s]; b.setAttribute('aria-pressed', String(s.has(t))); save();
    } }, t); return b;
  }));
  root.append(el('fieldset', {}, el('legend', {}, 'About me'),
    el('p', { class: 'muted small' }, 'Optional. Stored only on this device. If you connect an online AI, this is sent along with your messages so Phoenix can talk to you your way.'),
    el('div', { class: 'stack' },
      el('label', { class: 'field' }, 'What should Phoenix call you?', name),
      el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'How do you describe yourself?'), tags),
      el('label', { class: 'field' }, 'Anything Phoenix should know?', el('span', { class: 'hint' }, 'What helps, what does not, how you like to be spoken to.'), about))));

  // ---------------------------------------------------- pronouns, for the person and for Phoenix
  const mine = el('select', { class: 'input', 'aria-label': 'My pronouns' }, PERSON_PRONOUNS.map(([v, l]) => el('option', { value: v, selected: (state.profile.pronouns || '') === v }, l)));
  const mineCustom = el('input', { class: 'input', value: state.profile.pronounsCustom || '', maxlength: '30', autocomplete: 'off', placeholder: 'For example: xe/xem', 'aria-label': 'My pronouns, in my own words' });
  const customRow = el('label', { class: 'field' }, 'Your pronouns, in your own words', mineCustom); customRow.hidden = state.profile.pronouns !== 'other';
  mine.addEventListener('change', () => { state.profile.pronouns = mine.value; customRow.hidden = mine.value !== 'other'; save(); });
  mineCustom.addEventListener('input', () => { state.profile.pronounsCustom = cleanPronouns(mineCustom.value); save(); });
  const phoenixSeg = seg(Object.entries(PHOENIX_SETS).map(([k, s]) => [k, s.label]), () => state.prefs.phoenixPronouns || 'he', (v) => { state.prefs.phoenixPronouns = v; trackFeature('phoenix_pronouns_' + v); bus.emit('pronouns'); setTimeout(() => { save(); mountSettings(container); }, 0); }, 'Phoenix’s pronouns');
  root.append(el('fieldset', { id: 'pronouns-section' }, el('legend', {}, 'Pronouns'),
    el('p', { class: 'muted small' }, 'Both are your choice. Phoenix is an AI, so there is no right answer for Phoenix: pick whatever feels comfortable, and change it whenever you like.'),
    el('div', { class: 'stack' },
      el('label', { class: 'field' }, 'Your pronouns', el('span', { class: 'hint' }, 'Optional. Phoenix will use them if it ever talks about you in the third person.'), mine),
      customRow,
      el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'Phoenix’s pronouns'), phoenixSeg,
        el('div', { class: 'muted small', style: { marginTop: '.3rem' } }, ph('Right now Phoenix uses {they}, {them} and {their}. The app, and Phoenix when talking about Phoenix, will use these.'))))));

  // ---------------------------------------------------- how Phoenix talks
  const acctBox = accountSection();
  root.append(acctBox);
  root.append(el('fieldset', {}, el('legend', {}, 'How Phoenix talks'), el('div', { class: 'stack' },
    el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'Length of replies'), seg([['short', 'Short'], ['normal', 'Medium'], ['detailed', 'Detailed']], () => state.prefs.replyLength, (v) => (state.prefs.replyLength = v), 'Reply length')),
    el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'Tone'), seg([['gentle', 'Gentle'], ['direct', 'Direct'], ['playful', 'Playful']], () => state.prefs.tone, (v) => (state.prefs.tone = v), 'Tone')),
    toggle('Literal language', () => state.prefs.literal, (v) => (state.prefs.literal = v), 'No idioms, sarcasm or hints. Says exactly what it means. Applies when an AI is connected.'))));

  // ---------------------------------------------------- daily check-in reminder
  const remBox = el('fieldset', { id: 'reminders-section' }, el('legend', {}, 'Daily check-in'));
  root.append(remBox);
  drawReminders(remBox);

  // ---------------------------------------------------- optional: share check-in scores with NeuroHub (off by default)
  const shareBox = el('fieldset', { id: 'share-section' }, el('legend', {}, 'Help NeuroHub understand wellbeing (optional)'));
  root.append(shareBox);
  drawShare(shareBox);

  // ---------------------------------------------------- AI
  const aiBox = el('fieldset', { id: 'ai-section' }, el('legend', {}, 'The AI'));
  root.append(aiBox);
  drawAI(aiBox);

  // ---------------------------------------------------- neurohubcommunity.org knowledge
  const siteStatus = el('p', { class: 'muted small', 'aria-live': 'polite' });
  const recStatus = el('p', { class: 'muted small' }); loadCatalog().then(() => { recStatus.textContent = catalogSize() ? `${catalogSize()} guides, courses and products from the permitted websites are built into the app.` : ''; });
  const drawSite = () => { const i = siteInfo(); siteStatus.textContent = i.count ? `${i.articles} articles and pages from neurohubcommunity.org, and Helen Edgar’s Autistic Realms and More Realms websites, used with her permission (${i.source === 'refreshed' ? 'refreshed' : 'built into the app'}${i.syncedAt ? ' on ' + fmtDate(i.syncedAt) : ''}), plus ${i.presentations} sections from NeuroHub’s training presentations and recorded conversations.` : 'Nothing loaded yet.'; };
  loadSite().then(drawSite);
  const refreshBtn = el('button', { class: 'btn btn-sm', onclick: async () => {
    refreshBtn.disabled = true; siteStatus.textContent = 'Contacting neurohubcommunity.org…';
    try { const n = await refreshSite((m) => { siteStatus.textContent = `Downloading ${m}…`; }); toast(`Refreshed: ${n} articles and pages`, { icon: '✅' }); }
    catch (e) { toast(e.message || 'Could not refresh', { icon: '⚠️', ms: 4200 }); }
    refreshBtn.disabled = false; drawSite();
  } }, 'Refresh from neurohubcommunity.org');
  root.append(el('fieldset', {}, el('legend', {}, 'Knowledge from NeuroHub Community and Helen Edgar'), el('div', { class: 'stack' },
    el('p', { class: 'muted small' }, 'Phoenix can draw on NeuroHub Community’s own articles, pages and training presentations when it answers, and link the articles so you can read more. This uses a copy stored in the app, so nothing is sent anywhere when you chat. If you use an online AI, the few relevant passages are sent to it along with your message, like anything else.'),
    toggle('Use NeuroHub articles and presentations', () => state.prefs.useSite, (v) => (state.prefs.useSite = v)),
    toggle('Suggest helpful guides, courses and products', () => state.prefs.recommend !== false, (v) => (state.prefs.recommend = v), 'Now and then, when something on NeuroHub Community’s or Helen Edgar’s websites really fits what you are dealing with, Phoenix may mention it, with its price if it costs money. These are made by the people behind Phoenix, so it is not an independent recommendation. Never during a hard moment, and at most a couple of things. You can also ask “any resources that could help?”.'),
    recStatus,
    siteStatus, el('div', { class: 'row' }, refreshBtn))));

  // ---------------------------------------------------- accessibility (font, size, spacing, theme, voice)
  root.append(el('fieldset', { id: 'a11y-section' }, el('legend', {}, 'Accessibility and appearance'), buildAccessibilityPanel()));

  // ---------------------------------------------------- country
  const sel = el('select', { class: 'input', 'aria-label': 'Country for helplines' }, el('option', { value: '' }, 'Detect from my device language'));
  loadCrisis().then((d) => { for (const c of Object.keys(d.countries).sort((a, b) => d.countries[a].name.localeCompare(d.countries[b].name))) sel.append(el('option', { value: c, selected: state.prefs.country === c }, d.countries[c].name)); sel.value = state.prefs.country || ''; }).catch(() => {});
  sel.addEventListener('change', () => { state.prefs.country = sel.value; save(); });
  root.append(el('fieldset', {}, el('legend', {}, 'Where are you?'), el('p', { class: 'muted small' }, 'Used only to show the right helplines and emergency number. It never leaves this device.'), sel));

  // ---------------------------------------------------- install as an app (web version only)
  root.append(floatSection());
  root.append(wakeSection());
  root.append(el('fieldset', { id: 'install-section' }, el('legend', {}, 'Install as an app'), installPanel()));

  // ---------------------------------------------------- data
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    try { importData(await f.text()); applyLook(); toast('Backup restored', { icon: '✅' }); mountSettings(container); } catch (e) { toast(e.message || 'Could not read that file', { icon: '⚠️', ms: 4000 }); }
  });
  root.append(el('fieldset', {}, el('legend', {}, 'Your data'),
    el('p', { class: 'muted small' }, 'Everything Phoenix remembers (chats, check-ins, tasks and settings) lives on this device. Unless you make the optional account above, nothing is kept anywhere else, so nobody else can read it and nobody can recover it for you. Back it up if it matters.'),
    el('p', { class: 'muted small' }, 'Saved in this browser, on this device. Your browser has been asked to keep it, but clearing site data would erase it, so download a backup now and then.'),
    toggle('Remind me about donating, at most once a week', () => state.prefs.donateReminders !== false, (v) => (state.prefs.donateReminders = v), 'A small card, never a notification. It waits a week after you start, stays away after hard days, and rests for a month if you open the donate options.'),
    toggle('Share anonymous usage counts with NeuroHub', () => state.prefs.analytics !== false, (v) => (state.prefs.analytics = v), 'Counts app opens, installs and which kind of AI is chosen, as daily totals. No identifier, no cookies, and nothing you write or check in. It helps NeuroHub keep Phoenix free. Off means nothing is sent.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => { trackFeature('backup_export'); download(`phoenix-backup-${dayKey()}.json`, exportData(), 'application/json'); } }, 'Download a backup'),
      el('button', { class: 'btn', onclick: () => file.click() }, 'Restore a backup'), file,
      el('button', { class: 'btn btn-danger', onclick: () => modal({ title: 'Delete everything?', body: el('p', {}, 'This permanently deletes your chats, check-ins, tasks, plan and settings from this device. It cannot be undone.'),
        actions: [{ label: 'Cancel' }, { label: 'Delete everything', class: 'btn-danger', onclick: () => { trackFeature('data_deleted'); resetAll(); applyLook(); toast('Deleted'); mountSettings(container); } }] }) }, 'Delete everything'))));

  // ---------------------------------------------------- about
  root.append(el('fieldset', {}, el('legend', {}, 'About Phoenix'), el('div', { class: 'stack small' },
    el('p', {}, 'Phoenix is a free, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people, made by NeuroHub Community, an Autistic-led organisation. It is built around the ideas in David Gray-Hammond’s books. Full catalogue: ', el('a', { href: 'https://mybook.to/dgh-full-catalogue', target: '_blank', rel: 'noopener noreferrer' }, 'mybook.to/dgh-full-catalogue')),
    el('p', {}, 'Community: ', el('a', { href: 'https://connect.neurohubcommunity.org/p/join', target: '_blank', rel: 'noopener noreferrer' }, 'connect.neurohubcommunity.org'), ' · ', el('a', { href: 'https://neurohubcommunity.org', target: '_blank', rel: 'noopener noreferrer' }, 'neurohubcommunity.org')),
    el('p', {}, 'Phoenix is free, with no ads and no account needed. NeuroHub Community is a small Autistic-led social enterprise, and every AI reply costs us money, so donations are what keep Phoenix AI live. ', el('button', { class: 'btn btn-sm donate-btn', onclick: () => openDonate() }, '♥ Donate to NeuroHub Community'), ' There is never any pressure, and Phoenix works the same either way.'),
    el('p', { class: 'muted' }, 'Phoenix is not a therapist, doctor or crisis service, and it cannot diagnose. Nothing it says is medical advice. If you are in danger or thinking of harming yourself, use the red Help button, or call your local emergency number.'),
    el('p', { class: 'muted' }, 'Version 1.2.0'))));

  // On a phone every section folds up under its heading (the one asked for opens), so Settings is a short list, not one long scroll.
  if (matchMedia('(max-width: 700px)').matches) {
    const open = { ai: 'ai-section', reminders: 'reminders-section', share: 'share-section', install: 'install-section', account: 'account-section' }[focus];
    for (const fs of root.querySelectorAll(':scope > fieldset')) {
      const lg = fs.querySelector(':scope > legend'); if (!lg || fs.classList.contains('toggles')) continue;
      const expanded = fs.id === open; fs.classList.add('collapsible'); fs.classList.toggle('collapsed', !expanded);
      lg.setAttribute('role', 'button'); lg.tabIndex = 0; lg.setAttribute('aria-expanded', String(expanded));
      const flip = () => { const c = fs.classList.toggle('collapsed'); lg.setAttribute('aria-expanded', String(!c)); };
      lg.addEventListener('click', flip); lg.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    }
  }
  if (focus === 'account') setTimeout(() => acctBox.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  if (focus === 'ai') requestAnimationFrame(() => aiBox.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if (focus === 'install') requestAnimationFrame(() => document.getElementById('install-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if (focus === 'share') requestAnimationFrame(() => shareBox.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  if (focus === 'reminders') requestAnimationFrame(() => remBox.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// ---------------------------------------------------------------- optional sharing of check-in scores
function drawShare(box) {
  box.querySelectorAll(':scope > :not(legend)').forEach((n) => n.remove());
  const s = state.share || (state.share = { on: false, pid: '', since: '', pending: [], asked: false });
  const status = el('p', { class: 'small', 'aria-live': 'polite', role: 'status' });
  if (s.on) {
    box.append(el('div', { class: 'stack' },
      el('p', {}, '✅ You are sharing your check-in scores, anonymously, since ' + fmtDate(s.since) + '. Thank you. It helps NeuroHub see what people need.'),
      el('p', { class: 'muted small' }, 'What is sent: a random ID made on this device, the date, and seven numbers from 1 to 5. Nothing you write is ever sent.'),
      el('div', { class: 'row-wrap' },
        el('button', { class: 'btn', onclick: async () => { await stopSharing({ erase: false }); drawShare(box); toast('Sharing stopped. What was shared before stays until you delete it.'); } }, 'Stop sharing'),
        el('button', { class: 'btn btn-danger', onclick: () => modal({ title: 'Stop sharing and delete what you shared?', body: el('p', {}, 'This stops sharing and deletes every score you have shared from NeuroHub’s server. It cannot be undone. Your own check-ins on this device are not affected.'),
          actions: [{ label: 'Keep sharing' }, { label: 'Stop and delete', class: 'btn-danger', keepOpen: true, onclick: async (close) => { const r = await stopSharing({ erase: true }); close(); drawShare(box); toast(r.deleted ? 'Stopped, and what you shared has been deleted.' : 'Sharing is stopped, but the deletion could not reach the server. Please try again when you are online.', { ms: 5000 }); return false; } }] }) }, 'Stop and delete what I shared')),
      status));
    return;
  }
  const adult = el('input', { type: 'checkbox', id: 'share-age' });
  const past = el('input', { type: 'checkbox', id: 'share-past' });
  const go = el('button', { class: 'btn btn-primary', disabled: true, onclick: async () => {
    go.disabled = true; status.textContent = 'Turning on…';
    try { await startSharing({ includePast: past.checked }); toast('Thank you. Sharing is on.', { icon: '💜' }); drawShare(box); }
    catch { status.textContent = 'Sharing is on, but your earlier check-ins could not be sent just now. They will not be sent unless you try again.'; state.share.on = true; drawShare(box); }
  } }, 'Share my check-in scores');
  adult.addEventListener('change', () => { go.disabled = !adult.checked; });
  box.append(el('div', { class: 'stack' },
    el('p', {}, 'NeuroHub Community would like to understand how people are doing over time, and what helps, so it can improve Phoenix and its services. If you choose, Phoenix can share your check-in scores with NeuroHub. This is completely optional, and off unless you turn it on.'),
    el('ul', {},
      el('li', {}, el('strong', {}, 'What is sent: '), 'the date and seven numbers from 1 to 5 (your overall score and the six areas), each time you check in, with a random ID made on this device to link them. That is all.'),
      el('li', {}, el('strong', {}, 'What is never sent: '), 'your name, anything you write (notes, “what I will protect”, chats, documents), your location, or any way to identify your device.'),
      el('li', {}, el('strong', {}, 'Who sees it: '), 'only people at NeuroHub with the Admin role, in a private, signed-in backend. Results are combined into group trends. Individual lines show only as anonymous labels, and only once at least five people share.'),
      el('li', {}, el('strong', {}, 'What it is used for: '), 'understanding wellbeing and improving Phoenix. NeuroHub may publish anonymous, combined findings, never anything about an individual.'),
      el('li', {}, el('strong', {}, 'Stopping: '), 'you can stop at any time, and delete everything you shared with one tap. Scores are kept until you delete them, or for two years, whichever is sooner.'),
      el('li', {}, el('strong', {}, 'Not a safety net: '), 'nobody watches this live and NeuroHub cannot contact you, so it is not a way to get help. If you are struggling, use the red Help button.')),
    el('label', { class: 'switch' }, adult, el('span', {}, 'I am 16 or over, and I understand and agree to the above')),
    el('label', { class: 'switch' }, past, el('span', {}, 'Also share the check-ins I have already made (optional)')),
    el('div', { class: 'row-wrap' }, go), status));
}

// ---------------------------------------------------------------- daily check-in reminder and who can see check-ins
function drawReminders(box) {
  const r = state.reminders;
  const status = el('p', { class: 'small', 'aria-live': 'polite' });
  const drawStatus = (extra = '') => {
    const perm = notifSupport();
    status.textContent = extra || (!r.enabled ? 'The reminder is off.'
      : perm === 'granted' ? `Phoenix will send a notification each day at ${r.time} if you have not checked in. Web browsers only allow this while the app is open or installed, so for a reminder you can rely on, also add the daily event to your calendar.`
      : perm === 'denied' ? `Your reminder is set for ${r.time}, but notifications are blocked for Phoenix in this browser. Allow them in the site settings, or use the calendar event below.`
      : `Your reminder is set for ${r.time}, but notifications are not available here. Use the calendar event below for a reminder on any device.`);
  };
  const timeIn = el('input', { class: 'input', type: 'time', value: r.time, 'aria-label': 'Reminder time', style: { maxWidth: '9rem' } });
  timeIn.addEventListener('change', async () => { const res = await setReminder({ time: timeIn.value }); if (!res.ok) toast(res.message, { icon: '⚠️' }); drawStatus(res.message); });
  const on = el('input', { type: 'checkbox', checked: !!r.enabled });
  on.addEventListener('change', async () => { const res = await setReminder({ enabled: on.checked }); trackFeature(state.reminders.enabled ? 'reminders_on' : 'reminders_off'); on.checked = state.reminders.enabled; drawStatus(res.message); });
  const seeSel = el('select', { class: 'input', 'aria-label': 'Can the AI see my check-ins?' },
    el('option', { value: 'no' }, 'No, never (recommended)'), el('option', { value: 'yes' }, 'Yes, Phoenix AI may read a short summary'));
  seeSel.value = state.prefs.aiSeesCheckins === 'yes' ? 'yes' : 'no'; seeSel.addEventListener('change', () => { state.prefs.aiSeesCheckins = seeSel.value; save(); });
  drawStatus();
  box.append(el('div', { class: 'stack' },
    el('p', { class: 'muted small' }, 'A short daily check-in across six areas of your life shows how you are doing over time, and what might help. A reminder can nudge you once a day. It never repeats, never scolds and is easy to switch off.'),
    el('div', {}, el('label', { class: 'switch' }, on, el('span', {}, 'Remind me every day to check in'))),
    el('label', { class: 'field' }, 'Reminder time', timeIn),
    status,
    el('div', { class: 'row' },
      el('button', { class: 'btn btn-sm', onclick: async () => { const ok = await testReminder(); toast(ok ? 'Test notification sent.' : 'Could not show a notification here. The calendar event still works.', { icon: ok ? '🔔' : '⚠️' }); } }, 'Send a test notification'),
      el('button', { class: 'btn btn-sm', onclick: () => { downloadIcs(); toast('Open the file to add the daily event to your calendar.'); } }, 'Add to my calendar (.ics)')),
    el('label', { class: 'field' }, 'Can the AI read my check-ins?',
      el('span', { class: 'hint' }, 'A short summary of your scores and notes helps it talk with you about how you have been. Your check-ins never leave this device, except this summary when the AI you have chosen reads it. Online AI services receive it with your message.'), seeSel)));
}

// ---------------------------------------------------------------- the AI: Phoenix's own, or none
/** Say "Phoenix" to start talking: only in the installed app, and only if switched on. */
function wakeSection() {
  const box = el('fieldset', { id: 'wake-section' }, el('legend', {}, 'Say “Phoenix” to talk'));
  const draw = () => {
    box.querySelectorAll(':scope > :not(legend)').forEach((n) => n.remove());
    const body = el('div', { class: 'stack' }, el('p', {}, ph('Say “Phoenix” (or “Hey Phoenix”) and {they} {start|starts} a spoken conversation: {they} {listen|listens}, {answer|answers} out loud, and {listen|listens} again until you press Stop. You can say what you want straight after {their} name, like “Phoenix, I feel overwhelmed”.')));
    if (!voiceSupport.stt) body.append(el('div', { class: 'notice' }, 'This needs speech recognition, which Microsoft Edge, Google Chrome and Safari have. Firefox does not.'));
    else if (!isInstalled()) body.append(el('div', { class: 'notice' }, 'This is for the installed app. Install Phoenix as an app first (see “Install as an app” below), then open the app and come back here to turn it on.'));
    else if (!voiceAllowed()) body.append(el('div', { class: 'notice' }, 'Voice chat is for people with a free Phoenix account. ', el('a', { href: '#/settings/account' }, 'Make an account or sign in'), ' (an emailed code, no password), then come back here to turn this on.'));
    else {
      const on = wakeEnabled();
      body.append(
        el('p', { class: 'small', role: 'status', 'aria-live': 'polite' }, on ? (wakeListening() ? ph('On. The microphone is open and Phoenix is listening for {their} name.') : ph('On. Phoenix will listen for {their} name while the app is open.')) : 'Off. The microphone is not in use.'),
        el('div', { class: 'row-wrap' }, on
          ? el('button', { class: 'btn', type: 'button', onclick: () => { disableWake(); draw(); } }, 'Turn off listening for “Phoenix”')
          : el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => { await enableWake(); draw(); } }, 'Turn on listening for “Phoenix”')),
        el('p', { class: 'muted small' }, (voiceSupport.onDevice ? ph('While this is on, the microphone is open whenever Phoenix is. What it hears is turned into text on this computer, offline, and never sent anywhere. Phoenix keeps no audio and ignores everything that does not start with {their} name. You can switch the microphone off for good from the Phoenix icon near the clock. Not for places where private conversations could be overheard.') : ph('While this is on, the microphone is open whenever the app is, and in Chrome and Edge your browser sends what it hears to Google or Microsoft to turn into text. Phoenix keeps no audio and ignores everything that does not start with {their} name. Not for places where private conversations could be overheard.'))));
    }
    box.append(body);
  };
  draw();
  bus.on('wake', () => { if (box.isConnected) draw(); }); bus.on('account', () => { if (box.isConnected) draw(); });
  return box;
}

/** Floating Phoenix: how it works, a button to start it, and gentle check-ins (off unless chosen). */
function floatSection() {
  const supported = floatSupported();
  const nudge = el('select', { class: 'input', 'aria-label': 'Check on me while Phoenix is floating' },
    [['0', 'Never (recommended)'], ['20', 'Every 20 minutes'], ['30', 'Every 30 minutes'], ['45', 'Every 45 minutes'], ['60', 'Every hour']].map(([v, l]) => el('option', { value: v }, l)));
  nudge.value = String(state.float?.nudgeMins || 0);
  nudge.addEventListener('change', () => setNudges(nudge.value));
  return el('fieldset', { id: 'float-section' }, el('legend', {}, 'Floating Phoenix'),
    el('div', { class: 'stack' },
      el('p', {}, ph('Phoenix can float in a small window on top of everything else while you work: a big animated Phoenix with a speech bubble, who can help with what you are doing, keep you company, or talk with you out loud (press Talk, and {they} {listen|listens}, {answer|answers} aloud, and {listen|listens} again). Press Float, then minimise Phoenix. {They} {stay|stays} beside your work, and {come|comes} home when you come back.')),
      el('p', { class: 'muted small' }, ph('Phoenix cannot see your screen. Tell {them} what you are doing in the floating window and {they} will help with that. It is the same chat, saved on this device.')),
      supported
        ? el('div', { class: 'row-wrap' }, el('button', { class: 'btn btn-primary', type: 'button', onclick: () => openFloat() }, 'Float Phoenix now'), el('span', { class: 'muted small' }, 'Your browser only lets this start when you press the button.'))
        : el('div', { class: 'notice' }, 'Floating Phoenix needs Microsoft Edge or Google Chrome on a computer. Firefox, Safari and phones cannot float windows on top of other programs. On those, install Phoenix as an app and keep it open beside your work.'),
      supported ? el('label', { class: 'stack' }, el('span', {}, ph('Gentle check-ins while {they} {are|is} floating')), nudge, el('span', { class: 'muted small' }, 'A small message in the floating window now and then. You can answer, ignore it, or stop it any time.')) : null));
}

function drawAI(box) {
  box.querySelectorAll(':scope > :not(legend)').forEach((n) => n.remove());
  const p = state.provider;
  const kinds = [
    ['shared', '🔥', 'Phoenix AI', 'Free for you, paid for by NeuroHub Community. A limited number of replies each day.'],
    ['offline', '🧰', 'Built-in helper (no AI)', 'Fully private: nothing you type leaves this device. Works offline. Explains ideas, helps you calm down and get started.'],
  ];
  const panel = el('div', { class: 'stack' });
  box.append(el('div', { class: 'grid' }, kinds.map(([k, ico, title, blurb]) => el('button', { class: 'card tile', 'aria-pressed': String(p.kind === k), style: { borderColor: p.kind === k ? 'var(--accent)' : undefined, borderWidth: p.kind === k ? '4px' : undefined },
    onclick: () => { if (p.kind !== k) trackFeature(k === 'shared' ? 'ai_on' : 'ai_off'); p.kind = k; save(); drawAI(box); } }, el('span', { class: 'ico', 'aria-hidden': 'true' }, ico), el('strong', {}, title), el('span', { class: 'muted small' }, blurb), p.kind === k ? el('span', { class: 'chip' }, '✓ Selected') : null))), panel);

  if (p.kind === 'shared') {
    const left = el('p', { class: 'small', 'aria-live': 'polite' }, 'Checking…');
    sharedStatus().then((s) => { left.textContent = !s ? 'Could not reach Phoenix AI just now. Check your internet connection.' : s.ai ? `Available. You have ${s.left} of ${s.perDay} replies left today.` : 'Phoenix AI is switched off at the moment. The built-in helper still works.'; });
    panel.append(
      el('div', { class: 'notice' }, el('strong', {}, 'Free for you, but not private in the same way. '), 'Your messages are sent to NeuroHub Community’s server, which passes them to Anthropic’s Claude to write a reply. NeuroHub does not store or read them, and only keeps anonymous counters to enforce the daily limit. Please avoid names and identifying details. For fully private conversations, choose the built-in helper.'),
      el('p', {}, 'Every AI reply costs NeuroHub a small amount, and there is a daily limit for each person and for everyone together so it can stay free. When it runs out, the built-in helper and Toolkit still work.'),
      left,
      el('div', { class: 'row-wrap' }, el('button', { class: 'btn donate-btn', onclick: () => openDonate() }, '♥ Help cover the cost of the AI'), el('span', { class: 'muted small' }, 'Give once or monthly. Never any pressure.')),
      el('p', { class: 'muted small' }, 'Your daily check-ins are not sent to Phoenix AI.'));
  } else {
    panel.append(el('p', {}, 'Phoenix is using the built-in helper. It cannot hold a free-flowing conversation, but it does not need internet or an account, and nothing you say leaves your device.'),
      el('p', { class: 'muted' }, 'When you want open conversation, choose Phoenix AI above. You can switch back at any time.'));
  }
}
