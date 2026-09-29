// The chat screen: Phoenix the mascot, the conversation, voice in and out, and the safety layer.
import { el, fmt, modal, toast, announce, prefersReducedMotion, copyText, fmtDate, sleep } from './util.js';
import { phoenixSVG, setPhoenixState } from './mascot.js';
import { state, save, currentChat, newChat, deleteChat, aiActive, checkBudget, recordUsage } from './store.js';
import { CRISIS_RE, EMERGENCY_RE, crisisText, crisisReply, loadCrisis, guessCountry, openHelp } from './crisis.js';
import { KB } from './kb.js';
import { medicationIntent, medicationReply, siteQuestionIntent, siteListReply, validateCrisisReply, CRISIS_FOLLOWUP, isSmallModel } from './guard.js';
import { buildSystem } from './persona.js';
import { streamChat, providerConfig } from './providers.js';
import { offlineReply, findTopic, topicReply } from './offline.js';
import { loadSite, siteHits, siteBlock } from './site.js';
import { voiceSupport, createRecognizer, createSpeaker, listVoices } from './voice.js';

let go = () => {};            // navigation callback supplied by main.js
let footEl, mascot, statusEl, listEl, inputEl, sendBtn, micBtn, chipsEl, pillEl, root;
let busy = false, listening = false, speaking = false, tempState = null, abortCtl = null, rec = null, handsFreeActive = false, lastViaVoice = false, emptyTurns = 0;
let beatTimer = null;

const speaker = createSpeaker({
  getSettings: () => state.prefs,
  onSpeakingChange: (s) => { speaking = s; refreshState(); if (!s) maybeRelisten(); },
  onWord: () => beat(),
});

function beat() {
  if (prefersReducedMotion() || !mascot) return;
  mascot.classList.add('beat');
  clearTimeout(beatTimer);
  beatTimer = setTimeout(() => mascot?.classList.remove('beat'), 130);
}

const STATUS = { idle: 'Here when you need me', listening: 'Listening…', thinking: 'Thinking…', talking: 'Speaking…', happy: 'Glad to help', concerned: 'Here with you' };
function baseState() { return tempState || (listening ? 'listening' : speaking ? 'talking' : busy ? 'thinking' : 'idle'); }
function refreshState() {
  const st = baseState();
  setPhoenixState(mascot, st);
  if (statusEl) statusEl.textContent = STATUS[st] || '';
  if (micBtn) { micBtn.setAttribute('aria-pressed', String(listening)); micBtn.classList.toggle('on', listening); }
  if (sendBtn) { sendBtn.textContent = busy ? 'Stop' : 'Send'; sendBtn.setAttribute('aria-label', busy ? 'Stop Phoenix answering' : 'Send message'); }
}
export function phoenixReact(kind, ms = 2400) {
  tempState = kind; refreshState();
  setTimeout(() => { if (tempState === kind) { tempState = null; refreshState(); } }, ms);
}

// ---------------------------------------------------------------- mounting
export function mountChat(container, { navigate }) {
  go = navigate;
  root = container;
  container.textContent = '';
  container.classList.add('chat-view');

  mascot = phoenixSVG(4);
  mascot.style.setProperty('--ph-size', '56px');
  statusEl = el('div', { class: 'ph-status', 'aria-live': 'off' });
  pillEl = el('button', { class: 'chip mode-pill btn-ghost', title: 'Change the AI Phoenix uses', onclick: () => go('settings:ai') });
  const newBtn = el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { stopAll(); newChat(); renderChat(); inputEl.focus(); } }, 'New chat');
  const histBtn = el('button', { class: 'btn btn-ghost btn-sm', onclick: openHistory }, 'History');
  container.append(el('div', { class: 'chat-head' }, mascot, el('div', { class: 'who' }, el('strong', {}, 'Phoenix'), statusEl), pillEl, histBtn, newBtn));

  listEl = el('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with Phoenix' });
  chipsEl = el('div', { class: 'chips' });
  container.append(listEl, chipsEl);

  inputEl = el('textarea', { class: 'input', rows: '1', placeholder: 'Say anything, or pick a suggestion…', 'aria-label': 'Message Phoenix', maxlength: '4000' });
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } });
  inputEl.addEventListener('input', () => { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 144) + 'px'; });
  sendBtn = el('button', { class: 'btn btn-purple', onclick: onSend }, 'Send');
  const row = el('div', { class: 'composer-row' }, inputEl);
  if (voiceSupport.stt) {
    micBtn = el('button', { class: 'btn ph-mic', 'aria-label': 'Speak to Phoenix', 'aria-pressed': 'false', title: 'Speak to Phoenix', onclick: toggleMic }, '🎤');
    row.append(micBtn);
  }
  row.append(sendBtn);
  const foot = el('div', { class: 'composer-foot' },
    footEl = el('span', {}, ''),
    voiceSupport.desktop ? el('span', {}, 'Tip: press Win + H to dictate.') : null);
  container.append(el('div', { class: 'composer' }, buildVoiceRow(), row, foot));

  renderChat();
  refreshState();
}

function updatePill() {
  if (!pillEl) return;
  if (footEl) footEl.textContent = aiActive() ? 'Phoenix is an AI, not a person or a therapist. Please avoid identifying details.' : 'Phoenix is a helper program, not a person or a therapist. Nothing you type leaves this device.';
  const p = state.provider;
  const label = !aiActive() ? 'Built-in helper (no AI)'
    : p.kind === 'ollama' ? `AI on this computer · ${p.ollama.model}`
    : p.kind === 'anthropic' ? `Claude · ${p.anthropic.model}`
    : `AI · ${p.openai.model}`;
  pillEl.textContent = label;
}

function chipsFor() {
  return aiActive()
    ? ['I am overwhelmed', 'Help me get started on something', 'Explain masking to me', 'Help me reply to a message', 'I just want to talk']
    : ['I am overwhelmed', 'What is monotropism?', 'I can’t start my task', 'What can you do?'];
}

function renderChat() {
  updatePill();
  const chat = currentChat();
  listEl.textContent = '';
  chipsEl.textContent = '';
  if (!chat.messages.length) {
    const hi = state.profile.name ? `Hi ${state.profile.name}.` : 'Hi.';
    const big = phoenixSVG(4); big.style.setProperty('--ph-size', '120px');
    listEl.append(el('div', { class: 'welcome' }, big,
      el('h1', {}, `${hi} I'm Phoenix.`),
      el('p', {}, 'A neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent minds. You are not broken. You do not have to mask here. You can say as much or as little as you like, and stop any time.'),
      aiActive() ? null : el('p', { class: 'muted small' }, 'No AI is connected yet, so I am running as the built-in helper. I can explain ideas, help you calm down and get started, and give you wording for hard messages. To talk freely, connect an AI in Settings. It can be free and private.')));
    for (const t of chipsFor()) chipsEl.append(el('button', { class: 'chip-btn', onclick: () => send(t) }, t));
  } else {
    chat.messages.forEach(renderMessage);
  }
  listEl.scrollTop = listEl.scrollHeight;
}

// ---------------------------------------------------------------- messages
function renderMessage(m) {
  const body = el('div', { class: 'bubble-text', html: fmt(m.content) });
  const node = el('div', { class: `msg ${m.role}` + (m.crisis ? ' crisis' : '') }, body);
  if (m.actions?.length) node.append(actionRow(m.actions));
  if (m.role === 'assistant' && !m.crisis && m.content && m.content !== '…') {
    node.append(el('div', { class: 'msg-tools' },
      el('button', { onclick: async () => toast((await copyText(m.content)) ? 'Copied' : 'Could not copy', { icon: '📋', ms: 1400 }) }, 'Copy'),
      voiceSupport.tts ? el('button', { onclick: () => speaker.speakNow(m.content) }, 'Read aloud') : null));
  }
  listEl.append(node);
  listEl.scrollTop = listEl.scrollHeight;
  return node;
}
function actionRow(actions) {
  return el('div', { class: 'msg-actions' }, actions.map((a) => el('button', { class: 'btn btn-sm', onclick: () => { if (a.go === 'help') openHelp(); else go(a.go); } }, a.label)));
}
function addMessage(role, content, extra = {}) {
  const chat = currentChat();
  const m = { role, content, ...extra };
  chat.messages.push(m);
  chat.updated = Date.now();
  if (role === 'user' && chat.title === 'New chat') chat.title = content.slice(0, 48);
  save();
  if (chat.messages.length === 1) { listEl.textContent = ''; chipsEl.textContent = ''; }
  return { m, node: renderMessage(m) };
}

async function crisisCard() {
  const d = await loadCrisis();
  const code = guessCountry();
  const text = crisisReply(d, d.countries[code] ? code : '');
  const { node } = addMessage('assistant', text, { crisis: true });
  node.append(el('div', { class: 'msg-actions' }, el('button', { class: 'btn btn-danger btn-sm', onclick: () => openHelp() }, 'Show more help and helplines')));
  phoenixReact('concerned', 4500);
  return text;
}

async function emergencyCard() {
  const d = await loadCrisis();
  const code = guessCountry();
  const number = d.countries[code]?.emergency || d.fallbackEmergency;
  const entry = KB.find((e) => e.id === 'overdose');
  const text = `**This sounds like an emergency.** Call ${number} now, and say what has been taken, even if you are not sure.\n\n${entry.why}\n\n**While you wait:** ${entry.helps}`;
  const { node } = addMessage('assistant', text, { crisis: true });
  node.append(el('div', { class: 'msg-actions' }, el('button', { class: 'btn btn-danger btn-sm', onclick: () => openHelp() }, 'Show emergency and helpline numbers')));
  phoenixReact('concerned', 4500);
}

// ---------------------------------------------------------------- sending
function onSend() { if (busy) { abortCtl?.abort(); return; } send(inputEl.value); }

export async function send(text, { viaVoice = false } = {}) {
  text = (text || '').trim();
  if (!text || busy) return;
  inputEl.value = ''; inputEl.style.height = 'auto';
  lastViaVoice = viaVoice;
  speaker.stop(); speaker.reset();
  addMessage('user', text);

  const crisis = CRISIS_RE.test(text);
  const emergency = EMERGENCY_RE.test(text);
  if (emergency) await emergencyCard();
  // An emergency about someone else does not also need the "I'm glad you told me" card, unless the person is talking about themselves.
  if (crisis && (!emergency || /suicid|kill (my ?self|me)|want(ed)? to die|self[- ]?harm|end (my|it all)/i.test(text))) await crisisCard();

  busy = true; refreshState();
  const speakIt = !!state.prefs.voiceReplies && voiceSupport.tts;
  try {
    // Guardrails that never depend on a model: medicine questions and "what has NeuroHub written" get vetted answers.
    if (!crisis && !emergency && medicationIntent(text)) { addMessage('assistant', medicationReply()); announce('Phoenix replied'); return; }
    if (!crisis && !emergency && state.prefs.useSite && siteQuestionIntent(text)) {
      await loadSite();
      addMessage('assistant', siteListReply(siteHits(text, 4), state.profile.name)); announce('Phoenix replied'); return;
    }
    if (!aiActive()) {
      if (crisis || emergency) return; // the vetted reply above is the whole answer; nothing clever to add
      const prev = currentChat().messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || '';
      await loadSite();
      const r = offlineReply(text, { name: state.profile.name, aiConfigured: false, lastAssistant: prev, siteHits: state.prefs.useSite ? (q) => siteHits(q, 2) : null });
      await sleep(prefersReducedMotion() ? 0 : 350);
      const { m, node } = addMessage('assistant', '', { actions: r.actions });
      const textEl = node.querySelector('.bubble-text');
      const parts = r.text.match(/[^\n]+\n*|\n+/g) || [r.text];
      let acc = '';
      for (const p of parts) {
        acc += p; textEl.innerHTML = fmt(acc); listEl.scrollTop = listEl.scrollHeight;
        if (speakIt) speaker.push(p);
        if (!prefersReducedMotion()) await sleep(70);
      }
      m.content = r.text; save();
      if (speakIt) speaker.end();
      node.replaceWith(renderMessage(m)); // re-render now the text is final, so the Copy / Read aloud tools appear
      announce('Phoenix replied');
      return;
    }

    // ---- real AI (if the person pays per token, respect the cap they set)
    const budget = checkBudget();
    if (!budget.ok) { addMessage('assistant', budget.message, { error: true }); return; }
    const d = await loadCrisis();
    const code = guessCountry();
    const block = crisisText(d, d.countries[code] ? code : '').text;
    const small = state.provider.kind === 'ollama' && isSmallModel(state.provider.ollama.model);
    if (small) {
      // A very small model cannot be trusted to be brief and low-demand when someone is overwhelmed: use the built-in answer.
      const r = offlineReply(text, { name: state.profile.name, aiConfigured: true });
      if (r.actions.some((a) => /^tool:(breathing|sensory|grounding|tasks|focus)$/.test(a.go))) {
        const { m, node } = addMessage('assistant', r.text, { actions: r.actions }); node.replaceWith(renderMessage(m)); announce('Phoenix replied'); return;
      }
    }
    // Definition questions ("what is monotropism?") are grounded in Phoenix's own vetted notes. A real 3B model got
    // monotropism wrong from memory. Small models just get the notes directly.
    const topic = /^\s*(what|whats|what's|who|explain|define|tell me about|can you explain)\b|\bmean(s|ing)?\b/i.test(text) ? findTopic(text) : null;
    if (topic && small) {
      const { m, node } = addMessage('assistant', topicReply(topic)); node.replaceWith(renderMessage(m)); announce('Phoenix replied'); return;
    }
    const topicNotes = topic ? `TOPIC NOTES (authoritative, from NeuroHub's books; base your answer on these and do not contradict them)\n${topic.title}\n${topic.what}\n${topic.why}\nWhat tends to help: ${topic.helps}` : '';
    await loadSite();
    const prevUser = currentChat().messages.filter((m) => m.role === 'user').slice(-2, -1)[0]?.content || '';
    const sb = state.prefs.useSite ? siteBlock(`${text} ${prevUser}`) : '';
    const system = buildSystem({ profile: state.profile, prefs: state.prefs, crisisBlock: block, crisisFlag: crisis, siteBlock: [topicNotes, sb].filter(Boolean).join('\n\n'), small });
    const history = currentChat().messages.filter((m) => !m.crisis && m.content && (m.role === 'user' || m.role === 'assistant')).slice(-20).map(({ role, content }) => ({ role, content }));
    while (history.length && history[0].role !== 'user') history.shift();

    const { m, node } = addMessage('assistant', '…');
    const textEl = node.querySelector('.bubble-text');
    let acc = '';
    abortCtl = new AbortController();
    try {
      await streamChat(providerConfig(state), {
        system, messages: history, signal: abortCtl.signal, maxTokens: small ? 220 : 1200,
        onText: (delta) => {
          acc += delta;
          if (crisis) return; // in a crisis the reply is held back and checked before anyone sees it
          textEl.innerHTML = fmt(acc); listEl.scrollTop = listEl.scrollHeight;
          if (speakIt) speaker.push(delta);
          refreshState();
        },
      });
      if (crisis) {
        // Small models quote outdated or foreign numbers and sometimes refuse coldly. Only show the reply if it is safe.
        const verdict = validateCrisisReply(acc, block);
        if (!verdict.ok) { console.warn('crisis reply replaced:', verdict.reason); acc = CRISIS_FOLLOWUP; }
        textEl.innerHTML = fmt(acc); listEl.scrollTop = listEl.scrollHeight;
        if (speakIt) speaker.push(acc);
      }
      if (speakIt) speaker.end();
      recordUsage(system.length + history.reduce((n, h) => n + h.content.length, 0), acc.length);
      m.content = acc || '…'; save();
      node.replaceWith(renderMessage(m));
      announce('Phoenix replied');
    } catch (e) {
      const aborted = e?.name === 'AbortError';
      if (aborted) { m.content = acc ? acc + ' …' : '(stopped)'; }
      else {
        console.warn(e);
        m.content = acc ? acc : (e.message || 'I could not reach the AI.');
        if (!acc) m.error = true;
        // during a crisis the person must never be left with nothing: the helplines are already on screen above
      }
      save();
      node.replaceWith(renderMessage(m));
      if (!aborted && !acc) {
        const fixBtn = el('div', { class: 'msg-actions' }, el('button', { class: 'btn btn-sm', onclick: () => go('settings:ai') }, 'Open AI settings'));
        listEl.lastChild.append(fixBtn);
      }
      speaker.stop();
    }
  } finally {
    busy = false; abortCtl = null; refreshState();
    if (!speaking) maybeRelisten();
  }
}

function stopAll() { abortCtl?.abort(); stopVoice(); }

// ---------------------------------------------------------------- history
function openHistory() {
  const wrap = el('div', {});
  const draw = () => {
    wrap.textContent = '';
    if (!state.chats.length) wrap.append(el('p', { class: 'muted' }, 'No conversations yet.'));
    for (const c of state.chats) {
      wrap.append(el('div', { class: 'help-line' },
        el('div', { style: { flex: '1', minWidth: 0 } },
          el('button', { class: 'btn btn-ghost btn-sm', style: { textAlign: 'left', maxWidth: '100%', justifyContent: 'flex-start' }, onclick: () => { state.currentChat = c.id; save(); m.close(); stopAll(); renderChat(); } }, c.title || 'Chat'),
          el('div', { class: 'muted small' }, `${fmtDate(c.updated)} · ${c.messages.length} messages`)),
        el('button', { class: 'btn btn-ghost btn-sm', 'aria-label': `Delete chat ${c.title}`, onclick: () => { deleteChat(c.id); draw(); renderChat(); } }, 'Delete')));
    }
  };
  const m = modal({ title: 'Your conversations', body: wrap, actions: [{ label: 'Close', class: 'btn-primary' }] });
  draw();
  wrap.before(el('p', { class: 'muted small' }, 'Kept only on this device. Deleting one removes it for good.'));
}

// ---------------------------------------------------------------- voice
function buildVoiceRow() {
  const row = el('div', { class: 'voice-row' });
  if (!voiceSupport.tts && !voiceSupport.stt) return row;
  if (voiceSupport.tts) {
    const replies = el('label', { class: 'switch' }, el('input', { type: 'checkbox', checked: !!state.prefs.voiceReplies }), el('span', {}, 'Read replies aloud'));
    replies.querySelector('input').addEventListener('change', (e) => { state.prefs.voiceReplies = e.target.checked; save(); if (!e.target.checked) speaker.stop(); });
    row.append(replies);
    const rate = el('label', { class: 'switch' }, el('span', {}, 'Speed'), el('input', { type: 'range', min: '0.7', max: '1.6', step: '0.1', value: String(state.prefs.voiceRate || 1), 'aria-label': 'Speaking speed' }));
    rate.querySelector('input').addEventListener('input', (e) => { state.prefs.voiceRate = Number(e.target.value); save(); });
    row.append(rate);
    const voices = listVoices('en');
    if (voices.length > 1) {
      const sel = el('select', { class: 'input', style: { width: 'auto', minHeight: '38px', padding: '.3em .6em' }, 'aria-label': 'Voice' }, el('option', { value: '' }, 'Default voice'), voices.map((v) => el('option', { value: v.name, selected: v.name === state.prefs.voiceName }, v.name)));
      sel.addEventListener('change', () => { state.prefs.voiceName = sel.value; save(); });
      row.append(sel);
    }
    row.append(el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { stopVoice(); } }, '⏹ Stop voice'));
  }
  if (voiceSupport.stt && voiceSupport.tts) {
    const hf = el('label', { class: 'switch', title: 'After Phoenix finishes speaking, the microphone opens again on its own.' }, el('input', { type: 'checkbox', checked: !!state.prefs.handsFree }), el('span', {}, 'Hands-free'));
    hf.querySelector('input').addEventListener('change', (e) => { state.prefs.handsFree = e.target.checked; if (e.target.checked) state.prefs.voiceReplies = true; save(); });
    row.append(hf);
  }
  return row;
}

async function ensureVoiceConsent() {
  if (state.voiceConsent) return true;
  return new Promise((resolve) => {
    let decided = false;
    const done = (v) => { if (!decided) { decided = true; resolve(v); } };
    modal({
      title: 'Talk to Phoenix',
      body: el('div', {},
        el('p', {}, 'Voice input uses your browser’s built-in speech recognition. Before you turn it on:'),
        el('ul', {},
          el('li', {}, 'Your browser will ask to use your microphone. It only listens after you press the mic.'),
          el('li', {}, 'In Chrome and Edge, your speech is sent to Google or Microsoft to be turned into text. Phoenix does not record your voice.'),
          el('li', {}, 'The text is then treated like a typed message.'),
          el('li', {}, 'You can type instead, at any time.')),
        el('p', { class: 'muted' }, 'Please do not say names or details that could identify you or someone else.')),
      actions: [
        { label: 'Not now', onclick: () => done(false) },
        { label: 'I understand, turn on voice', class: 'btn-primary', onclick: () => { state.voiceConsent = true; save(); done(true); } },
      ],
      onClose: () => done(false),
    });
  });
}

async function toggleMic() {
  if (listening) { rec?.stop(); return; }
  if (!(await ensureVoiceConsent())) return;
  emptyTurns = 0;
  startListening();
}

function startListening() {
  if (listening || busy) return;
  speaker.stop();
  rec = createRecognizer({
    lang: state.prefs.voiceLang || 'en-GB',
    onStart: () => { listening = true; refreshState(); announce('Listening'); },
    onInterim: (t) => { inputEl.value = t; },
    onEnd: ({ text, gotFinal }) => {
      listening = false; refreshState();
      if (gotFinal) { emptyTurns = 0; send(text, { viaVoice: true }); }
      else { emptyTurns++; if (state.prefs.handsFree && handsFreeActive && emptyTurns < 2) setTimeout(startListening, 600); else handsFreeActive = false; }
    },
    onError: (err) => {
      listening = false; refreshState();
      const msg = {
        'not-allowed': 'The microphone is blocked. You can allow it in your browser’s site settings, or type instead.',
        'service-not-allowed': 'Speech recognition is not allowed here. You can type instead.',
        'audio-capture': 'No microphone was found.',
        network: 'Speech recognition needs an internet connection.',
      }[err];
      if (msg) { toast(msg, { icon: '🎤', ms: 5000 }); handsFreeActive = false; }
    },
  });
  handsFreeActive = !!state.prefs.handsFree;
  rec?.start();
}

function stopVoice() { handsFreeActive = false; rec?.abort(); listening = false; speaker.stop(); refreshState(); }

function maybeRelisten() {
  if (handsFreeActive && state.prefs.handsFree && lastViaVoice && !speaking && !busy && root?.isConnected) {
    setTimeout(() => { if (handsFreeActive && !speaking && !busy) startListening(); }, 500);
  }
}

/** Called by main.js when leaving the chat screen. */
export function leaveChat() { stopVoice(); }
/** Lets other screens (for example the tools) hand Phoenix a message to start with. */
export function prefillChat(text, { autosend = false } = {}) {
  if (!inputEl) return;
  if (autosend) send(text); else { inputEl.value = text; inputEl.focus(); }
}
