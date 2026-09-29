// Settings: about me, how Phoenix talks, connecting an AI, appearance, your data.
import { el, toast, modal, download, dayKey, fmtDate } from './util.js';
import { state, save, flush, resetAll, exportData, importData, isPaidProvider, estimatedCost, resetUsage, storageInfo, revealStorage } from './store.js';
import { PRESETS, listModels, testConnection, providerConfig } from './providers.js';
import { loadCrisis } from './crisis.js';
import { loadSite, siteInfo, refreshSite } from './site.js';
import { applyLook, buildAccessibilityPanel } from './accessibility.js';

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

  // ---------------------------------------------------- how Phoenix talks
  root.append(el('fieldset', {}, el('legend', {}, 'How Phoenix talks'), el('div', { class: 'stack' },
    el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'Length of replies'), seg([['short', 'Short'], ['normal', 'Medium'], ['detailed', 'Detailed']], () => state.prefs.replyLength, (v) => (state.prefs.replyLength = v), 'Reply length')),
    el('div', {}, el('div', { style: { fontWeight: 700, marginBottom: '.3rem' } }, 'Tone'), seg([['gentle', 'Gentle'], ['direct', 'Direct'], ['playful', 'Playful']], () => state.prefs.tone, (v) => (state.prefs.tone = v), 'Tone')),
    toggle('Literal language', () => state.prefs.literal, (v) => (state.prefs.literal = v), 'No idioms, sarcasm or hints. Says exactly what it means. Applies when an AI is connected.'))));

  // ---------------------------------------------------- AI
  const aiBox = el('fieldset', { id: 'ai-section' }, el('legend', {}, 'Connect an AI (optional)'));
  root.append(aiBox);
  drawAI(aiBox);

  // ---------------------------------------------------- neurohubcommunity.org knowledge
  const siteStatus = el('p', { class: 'muted small', 'aria-live': 'polite' });
  const drawSite = () => { const i = siteInfo(); siteStatus.textContent = i.count ? `${i.count} articles and pages, ${i.source === 'refreshed' ? 'refreshed' : 'built into the app'} ${i.syncedAt ? 'on ' + fmtDate(i.syncedAt) : ''}.` : 'No articles loaded yet.'; };
  loadSite().then(drawSite);
  const refreshBtn = el('button', { class: 'btn btn-sm', onclick: async () => {
    refreshBtn.disabled = true; siteStatus.textContent = 'Contacting neurohubcommunity.org…';
    try { const n = await refreshSite((m) => { siteStatus.textContent = `Downloading ${m}…`; }); toast(`Refreshed: ${n} articles and pages`, { icon: '✅' }); }
    catch (e) { toast(e.message || 'Could not refresh', { icon: '⚠️', ms: 4200 }); }
    refreshBtn.disabled = false; drawSite();
  } }, 'Refresh from neurohubcommunity.org');
  root.append(el('fieldset', {}, el('legend', {}, 'Knowledge from neurohubcommunity.org'), el('div', { class: 'stack' },
    el('p', { class: 'muted small' }, 'Phoenix can draw on NeuroHub Community’s own articles and pages when it answers, and link them so you can read more. This uses a copy stored in the app, so nothing is sent anywhere when you chat. If you use an online AI, the few relevant passages are sent to it along with your message, like anything else.'),
    toggle('Use neurohubcommunity.org articles', () => state.prefs.useSite, (v) => (state.prefs.useSite = v)),
    siteStatus, el('div', { class: 'row' }, refreshBtn))));

  // ---------------------------------------------------- accessibility (font, size, spacing, theme, voice)
  root.append(el('fieldset', { id: 'a11y-section' }, el('legend', {}, 'Accessibility and appearance'), buildAccessibilityPanel()));

  // ---------------------------------------------------- country
  const sel = el('select', { class: 'input', 'aria-label': 'Country for helplines' }, el('option', { value: '' }, 'Detect from my device language'));
  loadCrisis().then((d) => { for (const c of Object.keys(d.countries).sort((a, b) => d.countries[a].name.localeCompare(d.countries[b].name))) sel.append(el('option', { value: c, selected: state.prefs.country === c }, d.countries[c].name)); sel.value = state.prefs.country || ''; }).catch(() => {});
  sel.addEventListener('change', () => { state.prefs.country = sel.value; save(); });
  root.append(el('fieldset', {}, el('legend', {}, 'Where are you?'), el('p', { class: 'muted small' }, 'Used only to show the right helplines and emergency number. It never leaves this device.'), sel));

  // ---------------------------------------------------- data
  const file = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return;
    try { importData(await f.text()); applyLook(); toast('Backup restored', { icon: '✅' }); mountSettings(container); } catch (e) { toast(e.message || 'Could not read that file', { icon: '⚠️', ms: 4000 }); }
  });
  root.append(el('fieldset', {}, el('legend', {}, 'Your data'),
    el('p', { class: 'muted small' }, 'Everything Phoenix remembers (chats, check-ins, tasks, settings and any API key) lives only on this device. There is no account and no server, so nobody else can read it, and nobody can recover it for you. Back it up if it matters.'),
    storageInfo() ? el('p', { class: 'small' }, 'Saved as a file on this computer, with a daily backup kept for a week: ', el('code', {}, storageInfo().file), ' ', el('button', { class: 'btn btn-sm', onclick: () => revealStorage() }, 'Show in folder')) : el('p', { class: 'muted small' }, 'Saved in this browser. Your browser has been asked to keep it, but clearing site data would erase it, so download a backup now and then.'),
    el('div', { class: 'row' },
      el('button', { class: 'btn', onclick: () => download(`phoenix-backup-${dayKey()}.json`, exportData(), 'application/json') }, 'Download a backup'),
      el('button', { class: 'btn', onclick: () => file.click() }, 'Restore a backup'), file,
      el('button', { class: 'btn btn-danger', onclick: () => modal({ title: 'Delete everything?', body: el('p', {}, 'This permanently deletes your chats, check-ins, tasks, plan, settings and any saved API key from this device. It cannot be undone.'),
        actions: [{ label: 'Cancel' }, { label: 'Delete everything', class: 'btn-danger', onclick: () => { resetAll(); applyLook(); toast('Deleted'); mountSettings(container); } }] }) }, 'Delete everything'))));

  // ---------------------------------------------------- about
  root.append(el('fieldset', {}, el('legend', {}, 'About Phoenix'), el('div', { class: 'stack small' },
    el('p', {}, 'Phoenix is a free, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people, made by NeuroHub Community, an Autistic-led organisation. It is built around the ideas in David Gray-Hammond’s books. Full catalogue: ', el('a', { href: 'https://mybook.to/dgh-full-catalogue', target: '_blank', rel: 'noopener noreferrer' }, 'mybook.to/dgh-full-catalogue')),
    el('p', {}, 'Community: ', el('a', { href: 'https://connect.neurohubcommunity.org/p/join', target: '_blank', rel: 'noopener noreferrer' }, 'connect.neurohubcommunity.org'), ' · ', el('a', { href: 'https://neurohubcommunity.org', target: '_blank', rel: 'noopener noreferrer' }, 'neurohubcommunity.org')),
    el('p', { class: 'muted' }, 'Phoenix is not a therapist, doctor or crisis service, and it cannot diagnose. Nothing it says is medical advice. If you are in danger or thinking of harming yourself, use the red Help button, or call your local emergency number.'),
    el('p', { class: 'muted' }, 'Version 1.0.0'))));

  if (focus === 'ai') requestAnimationFrame(() => aiBox.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

// ---------------------------------------------------------------- you pay your own tokens
function billingPanel(box) {
  const b = state.billing;
  const usage = el('p', { 'aria-live': 'polite' });
  const draw = () => {
    const cost = estimatedCost();
    usage.textContent = `This month so far (rough estimate): ${b.messages} message${b.messages === 1 ? '' : 's'}, about ${b.inTok.toLocaleString()} tokens in and ${b.outTok.toLocaleString()} out` + (cost == null ? '. Add your provider’s prices below to see an estimated cost.' : `, roughly ${b.currency}${cost.toFixed(cost < 1 ? 3 : 2)}.`);
  };
  const num = (label, hint, key, step) => {
    const i = el('input', { class: 'input', type: 'number', min: '0', step: String(step), value: b[key] ? String(b[key]) : '', placeholder: '0', 'aria-label': label });
    i.addEventListener('change', () => { b[key] = Math.max(0, Number(i.value) || 0); save(); draw(); });
    return el('label', { class: 'field' }, label, el('span', { class: 'hint' }, hint), i);
  };
  const cur = el('input', { class: 'input', value: b.currency, maxlength: '3', style: { maxWidth: '5rem' }, 'aria-label': 'Currency symbol' });
  cur.addEventListener('change', () => { b.currency = cur.value.trim() || '$'; save(); draw(); });
  draw();
  return el('div', { class: 'card stack' },
    el('h3', { style: { margin: 0 } }, 'You pay for your own tokens'),
    el('p', {}, 'With this option your messages are billed to ', el('strong', {}, 'your own account'), ' with the provider. Phoenix and NeuroHub Community do not see your key or your messages, take no cut, and pay nothing. If your key runs out of credit or hits its limit, the AI stops and Phoenix tells you why. The built-in helper and Toolkit keep working, and you can switch to it in one click.'),
    usage,
    num('Daily message limit', 'Phoenix stops sending paid messages after this many in a day. Leave empty or 0 for no limit.', 'dailyLimit', 1),
    el('div', { class: 'row' }, num('Price per million input tokens', 'From your provider’s price page.', 'inPerM', 0.01), num('Price per million output tokens', 'From your provider’s price page.', 'outPerM', 0.01), el('label', { class: 'field' }, 'Currency', cur)),
    el('p', { class: 'muted small' }, 'These numbers are only estimates kept on this device (about four characters per token). Your provider’s dashboard is the source of truth. For a hard limit, also set a spending cap in your provider’s account.'),
    el('div', { class: 'row' }, el('button', { class: 'btn btn-sm', onclick: () => { resetUsage(); draw(); toast('Usage estimate reset', { ms: 1400 }); } }, 'Reset the estimate')));
}

// ---------------------------------------------------------------- AI wizard
function drawAI(box) {
  box.querySelectorAll(':scope > :not(legend)').forEach((n) => n.remove());
  const p = state.provider;
  const kinds = [
    ['offline', '🧰', 'Built-in helper', 'No AI. Works offline. Explains ideas, helps you calm down and get started.'],
    ['ollama', '💻', 'On this computer (Ollama)', 'Free and private. Nothing leaves your machine.'],
    ['openai', '☁️', 'Free online (Gemini, Groq…)', 'Use your own free key from a provider with a free tier.'],
    ['anthropic', '✨', 'Claude (Anthropic)', 'Use your own Anthropic API key.'],
  ];
  const status = el('div', { class: 'notice', hidden: true, 'aria-live': 'polite' });
  const show = (ok, msg) => { status.hidden = false; status.className = 'notice ' + (ok ? 'good' : 'bad'); status.textContent = msg; };
  const panel = el('div', { class: 'stack' });

  const pick = el('div', { class: 'grid' }, kinds.map(([k, ico, title, blurb]) => el('button', { class: 'card tile', 'aria-pressed': String(p.kind === k), style: { borderColor: p.kind === k ? 'var(--accent)' : undefined, borderWidth: p.kind === k ? '4px' : undefined },
    onclick: () => { p.kind = k; save(); drawAI(box); } }, el('span', { class: 'ico', 'aria-hidden': 'true' }, ico), el('strong', {}, title), el('span', { class: 'muted small' }, blurb), p.kind === k ? el('span', { class: 'chip' }, '✓ Selected') : null)));

  const modelPicker = (cfgKey, sub, fetchLabel) => {
    const dl = el('datalist', { id: 'models-' + cfgKey });
    const input = el('input', { class: 'input', list: 'models-' + cfgKey, value: sub.model || '', placeholder: 'Model name', 'aria-label': 'Model' });
    input.addEventListener('change', () => { sub.model = input.value.trim(); save(); });
    const fetchBtn = el('button', { class: 'btn btn-sm', onclick: async () => {
      fetchBtn.disabled = true; show(true, 'Looking for models…');
      try {
        const models = await listModels(providerConfig(state));
        dl.textContent = ''; for (const m of models) dl.append(el('option', { value: m }));
        if (models.length) { show(true, `Found ${models.length} model${models.length === 1 ? '' : 's'}. Click the box and pick one.`); if (!sub.model) { sub.model = models[0]; input.value = models[0]; save(); } }
        else show(false, cfgKey === 'ollama' ? 'Ollama is running but has no models yet. In a terminal, run: ollama pull llama3.2' : 'No models were listed. You can still type a model name.');
      } catch (e) { show(false, e.message); }
      fetchBtn.disabled = false;
    } }, fetchLabel || 'Find models');
    return { dl, input, fetchBtn };
  };
  const testBtn = () => el('button', { class: 'btn btn-primary', onclick: async (e) => {
    e.target.disabled = true; show(true, 'Testing…');
    const r = await testConnection(providerConfig(state)); show(r.ok, r.message); e.target.disabled = false;
  } }, 'Test connection');

  if (p.kind === 'offline') {
    panel.append(el('p', {}, 'Phoenix is using the built-in helper. It cannot hold a free-flowing conversation, but it does not need internet, an account, or a key, and nothing you say leaves your device.'),
      el('p', { class: 'muted' }, 'When you are ready for open conversation, choose one of the other options above. The free-and-private one is Ollama.'));
  }

  if (p.kind === 'ollama') {
    const url = el('input', { class: 'input', value: p.ollama.url, 'aria-label': 'Ollama address' });
    url.addEventListener('change', () => { p.ollama.url = url.value.trim(); save(); });
    const mp = modelPicker('ollama', p.ollama, 'Find my models');
    panel.append(
      el('div', { class: 'notice' }, el('strong', {}, 'Free and private. '), 'Ollama runs an AI on your own computer. Your messages never leave it. You need a reasonably modern computer, and the first download is a few gigabytes.'),
      el('ol', {}, el('li', {}, 'Install Ollama from ', el('a', { href: 'https://ollama.com/download', target: '_blank', rel: 'noopener noreferrer' }, 'ollama.com/download'), ' and open it.'),
        el('li', {}, 'In a terminal (Command Prompt or PowerShell on Windows) run: ', el('code', {}, 'ollama pull llama3.2:3b'), ' — a good starting size. Bigger models (7 to 8 billion parameters and up) give clearly better, more careful answers if your computer can run them. Very small models (1 billion) can ramble and get facts wrong, so Phoenix answers medicine, crisis and “what has NeuroHub written” questions itself and does not leave those to the model.'),
        el('li', {}, 'Come back here and press “Find my models”, pick one, and test it.')),
      el('label', { class: 'field' }, 'Ollama address', el('span', { class: 'hint' }, 'Leave as it is unless you changed it.'), url),
      el('label', { class: 'field' }, 'Model', mp.input, mp.dl),
      el('div', { class: 'row' }, mp.fetchBtn, testBtn()),
      globalThis.phoenixNative ? null : el('p', { class: 'muted small' }, 'Using Phoenix in a web browser? Ollama must allow it: set the environment variable OLLAMA_ORIGINS to this site’s address, then restart Ollama. The Phoenix desktop app needs no setup.'));
  }

  if (p.kind === 'openai') {
    const o = p.openai;
    const preset = el('select', { class: 'input', 'aria-label': 'Service' }, Object.entries(PRESETS).map(([k, v]) => el('option', { value: k, selected: o.preset === k }, v.label)));
    const base = el('input', { class: 'input', value: o.baseUrl, placeholder: 'https://…/v1', 'aria-label': 'Address' });
    const key = el('input', { class: 'input', type: 'password', value: o.key, placeholder: 'Your API key', autocomplete: 'off', 'aria-label': 'API key' });
    const note = el('p', { class: 'muted small' });
    const keyLink = el('a', { target: '_blank', rel: 'noopener noreferrer' });
    const syncPreset = () => { const pr = PRESETS[o.preset] || PRESETS.custom; note.textContent = pr.note; keyLink.hidden = !pr.keyUrl; keyLink.href = pr.keyUrl || '#'; keyLink.textContent = pr.keyUrl ? `Get a key or learn more: ${pr.keyUrl.replace('https://', '')}` : ''; };
    preset.addEventListener('change', () => { o.preset = preset.value; const pr = PRESETS[o.preset]; if (pr.baseUrl) { o.baseUrl = pr.baseUrl; base.value = pr.baseUrl; } save(); syncPreset(); });
    base.addEventListener('change', () => { o.baseUrl = base.value.trim().replace(/\/+$/, ''); save(); });
    key.addEventListener('change', () => { o.key = key.value.trim(); save(); });
    const mp = modelPicker('openai', o, 'Find models');
    syncPreset();
    panel.append(
      el('div', { class: 'notice' }, el('strong', {}, 'Your messages go to that company. '), 'Free tiers have limits, and some providers may use free-tier chats to improve their products. Keep personal details out of your messages, and read their terms.'),
      el('label', { class: 'field' }, 'Service', preset), note, keyLink,
      el('label', { class: 'field' }, 'Address', base),
      el('label', { class: 'field' }, 'API key', el('span', { class: 'hint' }, 'Stored on this device only, in plain text. Do not use a key you cannot afford to lose, and use one with a spending limit.'), key),
      el('label', { class: 'field' }, 'Model', mp.input, mp.dl),
      el('div', { class: 'row' }, mp.fetchBtn, testBtn()),
      isPaidProvider() ? billingPanel(box) : el('p', { class: 'muted small' }, 'This address is on your own computer, so there is nothing to pay.'));
  }

  if (p.kind === 'anthropic') {
    const a = p.anthropic;
    const key = el('input', { class: 'input', type: 'password', value: a.key, placeholder: 'sk-ant-…', autocomplete: 'off', 'aria-label': 'Anthropic API key' });
    key.addEventListener('change', () => { a.key = key.value.trim(); save(); });
    const mp = modelPicker('anthropic', a, 'Find models');
    panel.append(
      el('div', { class: 'notice' }, el('strong', {}, 'Paid, pay-as-you-go. '), 'Anthropic charges per message. Create a key with a low spending limit. Your messages go to Anthropic.'),
      el('p', { class: 'muted small' }, el('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener noreferrer' }, 'Get a key at console.anthropic.com')),
      el('label', { class: 'field' }, 'API key', el('span', { class: 'hint' }, 'Stored on this device only, in plain text.'), key),
      el('label', { class: 'field' }, 'Model', mp.input, mp.dl),
      el('div', { class: 'row' }, mp.fetchBtn, testBtn()),
      billingPanel(box));
  }

  box.append(el('p', { class: 'muted small' }, 'Phoenix works without any AI. Connecting one lets it hold a free conversation. Safety features (the Help button and crisis detection) run inside the app and never depend on any AI.'), pick, panel, status);
}
