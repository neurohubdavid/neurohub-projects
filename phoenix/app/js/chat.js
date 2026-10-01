// The chat screen: Phoenix the mascot, the conversation, voice in and out, and the safety layer.
import { el, fmt, modal, toast, announce, prefersReducedMotion, copyText, fmtDate, sleep, ui, bus } from './util.js';
import { trackFeature, trackEmbedChat } from './analytics.js';
import { phoenixSVG, setPhoenixState } from './mascot.js';
import { state, save, currentChat, newChat, deleteChat, aiActive, aiMaySeeCheckins } from './store.js';
import { checkinIntent, chatReply, summaryForAI, checkedInToday, streak } from './sixpf.js';
import { reportIntent, reportReply, assessmentSummaryForAI } from './reports.js';
import { CRISIS_RE, EMERGENCY_RE, crisisText, crisisReply, loadCrisis, guessCountry, openHelp } from './crisis.js';
import { KB } from './kb.js';
import { medicationIntent, medicationReply, siteQuestionIntent, siteListReply, validateCrisisReply, CRISIS_FOLLOWUP, isSmallModel } from './guard.js';
import { buildSystem } from './persona.js';
import { streamChat, providerConfig, sharedStatus } from './providers.js';
import { openDonate } from './donate.js';
import { offlineReply, findTopic, topicReply } from './offline.js';
import { loadSite, siteHits, siteBlock } from './site.js';
import { reactToDraft, reactToSpeech, reactToSent, reactToReply, relay } from './mascot-live.js';
import { voiceAllowed, requireAccountForVoice } from './voice-gate.js';
import { voiceSupport, createRecognizer, createSpeaker, listVoices } from './voice.js';
import { memoryIntent, memoryReply, memoryBlock, memoryMode, shouldLearn, notesRequest, parseNotes, addMemory, deleteMemory } from './memory.js';

let go = () => {};            // navigation callback supplied by main.js
let aiNoteEl, footEl, mascot, statusEl, listEl, inputEl, sendBtn, micBtn, chipsEl, pillEl, root;
let busy = false, listening = false, speaking = false, tempState = null, abortCtl = null, rec = null, handsFreeActive = false, lastViaVoice = false, emptyTurns = 0;
let beatTimer = null;
let convoMode = false; // a spoken conversation: Phoenix listens, answers aloud, then listens again (the Talk button in the floating Phoenix)
let burst = false, burstTimer = null; // burst: Phoenix is "talking" for a moment each time more of her reply arrives
let compact = false; // true while Phoenix is in the small floating window (float.js)
/** Called by float.js: the chat shows shorter suggestions and tells the AI what the person is doing. */
export function setChatCompact(on) { compact = !!on; }

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
function baseState() { return tempState || (listening ? 'listening' : speaking || burst ? 'talking' : busy ? 'thinking' : 'idle'); }
function talkBurst() { burst = true; refreshState(); clearTimeout(burstTimer); burstTimer = setTimeout(() => { burst = false; refreshState(); }, 380); }
function refreshState() {
  const st = baseState();
  setPhoenixState(mascot, st);
  for (const n of ui.doc?.querySelectorAll?.('.ph') || []) setPhoenixState(n, st); // every Phoenix in this window (the big one in the floating window too)
  bus.emit('chat:state', st);
  relay('state', st); // the free-floating Phoenix on a website with the widget follows what she is doing here
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

  const nudgeAway = (() => { try { return sessionStorage.getItem('phoenix.nudgeHidden') === '1'; } catch { return false; } })();
  if (!checkedInToday(state.wellness) && !nudgeAway) {
    const n = streak(state.wellness);
    const nudgeEl = el('div', { class: 'checkin-nudge', role: 'region', 'aria-label': 'Daily check-in' },
      el('span', {}, state.wellness.length ? `Not checked in today${n ? ` (${n}-day streak so far)` : ''}. Two minutes, whenever you have the energy.` : 'Try a two-minute daily check-in. It shows how you are doing over time, and what might help.'),
      el('span', { class: 'row-wrap' }, el('button', { class: 'btn btn-sm btn-purple', onclick: () => go('checkin') }, 'Check in'),
        el('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Hide this for now', title: 'Hide this for now', onclick: () => { try { sessionStorage.setItem('phoenix.nudgeHidden', '1'); } catch { /* ignore */ } nudgeEl.remove(); } }, '✕')));
    container.append(nudgeEl);
  }
  listEl = el('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with Phoenix' });
  chipsEl = el('div', { class: 'chips' });
  container.append(listEl, chipsEl);

  inputEl = el('textarea', { class: 'input', rows: '1', placeholder: matchMedia('(max-width: 700px)').matches ? 'Say anything…' : 'Say anything, or pick a suggestion…', 'aria-label': 'Message Phoenix', maxlength: '4000' });
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } });
  inputEl.addEventListener('input', () => { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 144) + 'px'; reactToDraft(inputEl.value); });
  sendBtn = el('button', { class: 'btn btn-purple', onclick: onSend }, 'Send');
  const row = el('div', { class: 'composer-row' }, inputEl);
  const voiceRow = buildVoiceRow();
  if (voiceSupport.tts || voiceSupport.stt) {
    const vb = el('button', { class: 'btn voice-toggle', type: 'button', 'aria-label': 'Voice options', 'aria-expanded': 'false', title: 'Voice options', onclick: () => { const o = voiceRow.classList.toggle('open'); vb.setAttribute('aria-expanded', String(o)); } }, '🔊');
    row.append(vb);
  }
  if (voiceSupport.stt) {
    micBtn = el('button', { class: 'btn ph-mic', 'aria-label': voiceAllowed() ? 'Speak to Phoenix' : 'Speak to Phoenix (needs a free account)', 'aria-pressed': 'false', title: voiceAllowed() ? 'Speak to Phoenix' : 'Voice chat needs a free account', onclick: toggleMic }, '🎤');
    row.append(micBtn);
  }
  row.append(sendBtn);
  const foot = el('div', { class: 'composer-foot' },
    footEl = el('span', {}, ''),
    aiNoteEl = el('span', { class: 'ai-note', 'aria-live': 'polite' }),
    voiceSupport.desktop ? el('span', {}, 'Tip: press Win + H to dictate.') : null);
  container.append(el('div', { class: 'composer' }, voiceRow, row, foot));

  renderChat();
  refreshState();
  refreshAiNote();
}

/** Under the message box: Phoenix AI is paid for by NeuroHub, how many replies are left today, and a gentle way to help cover the cost. */
function refreshAiNote() {
  if (!aiNoteEl) return;
  aiNoteEl.textContent = '';
  if (state.provider.kind !== 'shared') return;
  sharedStatus().then((s) => {
    if (!aiNoteEl || state.provider.kind !== 'shared') return;
    const left = s?.ai ? s.left : null;
    aiNoteEl.textContent = '';
    aiNoteEl.append(el('span', {}, 'Phoenix AI is free for you and paid for by NeuroHub Community.' + (left == null ? '' : ` ${left} ${left === 1 ? 'reply' : 'replies'} left today.`) + ' '), el('button', { class: 'linklike', type: 'button', onclick: () => openDonate() }, '♥ Help cover the cost'));
  });
}

function updatePill() {
  if (!pillEl) return;
  if (footEl) footEl.textContent = aiActive() ? 'Phoenix is an AI, not a person or a therapist. Please avoid identifying details.' : 'Phoenix is a helper program, not a person or a therapist. Nothing you type leaves this device.';
  pillEl.textContent = aiActive() ? 'Phoenix AI' : 'Built-in helper (no AI)';
}

/** Names are shown back and sent to the AI, so keep them short and plain. */
export const cleanName = (s) => String(s || '').replace(/[\r\n\t<>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

/** First meeting: Phoenix asks what to call the person. A name, a nickname or nothing at all are all fine, and it is asked only once. */
function nameCard() {
  const input = el('input', { class: 'input', maxlength: '40', autocomplete: 'off', 'aria-label': 'What should Phoenix call you?', placeholder: 'A name, a nickname, or leave it blank' });
  const done = (skip) => { const v = skip ? '' : cleanName(input.value); state.profile.name = v; state.profile.nameAsked = true; if (v) trackFeature('name_given'); save(); renderChat(); announce(v ? `Nice to meet you, ${v}.` : 'No problem, no name needed.'); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(false); } });
  return el('section', { class: 'card name-ask', 'aria-labelledby': 'name-h' },
    el('h2', { id: 'name-h' }, 'What should I call you?'),
    el('p', { class: 'muted small' }, 'A first name, a nickname, or anything you like. You can change it any time in Settings, and you can skip this.'),
    input,
    el('div', { class: 'row-wrap', style: { marginTop: '.6rem' } }, el('button', { class: 'btn btn-primary', onclick: () => done(false) }, 'That’s me'), el('button', { class: 'btn btn-ghost', onclick: () => done(true) }, 'Skip, no name needed')));
}

/** Switches to Phoenix's free AI after saying plainly where messages go. Nothing is sent until the person agrees. */
function turnOnSharedAI() {
  modal({ title: 'Turn on Phoenix AI?',
    body: el('div', { class: 'stack' },
      el('p', {}, 'Phoenix AI is free for you. NeuroHub Community pays for every reply, so there is a daily limit for each person. Your messages go to NeuroHub’s server, which passes them to Anthropic’s Claude to write a reply. They are not stored or read by NeuroHub. Please avoid names and identifying details.'),
      el('p', { class: 'muted small' }, 'You can switch back to the built-in helper any time in Settings. Your daily check-ins are not sent to it.')),
    actions: [{ label: 'Not now' }, { label: 'Turn it on', class: 'btn-primary', onclick: () => { state.provider.kind = 'shared'; save(); renderChat(); refreshAiNote(); toast('Phoenix AI is on.', { icon: '🔥' }); } }] });
}

function chipsFor() {
  if (compact) return aiActive() ? ['Help me get started', 'I am stuck', 'Stay with me while I work', 'I need a break', 'I just want to talk'] : ['I am overwhelmed', 'I can’t start my task', 'What can you do?'];
  return aiActive()
    ? ['I am overwhelmed', 'How have I been doing this week?', 'Help me get started on something', 'Explain masking to me', 'I just want to talk']
    : ['I am overwhelmed', 'How have I been doing this week?', 'What is monotropism?', 'I can’t start my task', 'What can you do?'];
}

function renderChat() {
  updatePill();
  const chat = currentChat();
  listEl.textContent = '';
  chipsEl.textContent = '';
  if (!chat.messages.length) {
    const needName = !state.profile.name && !state.profile.nameAsked; // first meeting: ask what to call them
    const hi = state.profile.name ? `Hi ${state.profile.name}.` : 'Hi.';
    const big = phoenixSVG(4); big.style.setProperty('--ph-size', '120px');
    listEl.append(el('div', { class: 'welcome' }, big,
      el('h1', {}, needName ? 'Hi, I’m Phoenix.' : `${hi} I'm Phoenix.`),
      needName ? nameCard() : null,
      el('p', {}, 'A neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent minds. You are not broken. You do not have to mask here. You can say as much or as little as you like, and stop any time.'),
      aiActive() ? null : el('div', { class: 'stack' },
        el('p', { class: 'muted small' }, 'I am running as the built-in helper: I can explain ideas, help you calm down and get started, and give you wording for hard messages, and nothing you type leaves this device. For open conversation you can turn on Phoenix AI, which is free for you and paid for by NeuroHub Community.'),
        el('button', { class: 'btn btn-primary', onclick: turnOnSharedAI }, 'Turn on Phoenix AI'))));
    if (!needName) for (const t of chipsFor()) chipsEl.append(el('button', { class: 'chip-btn', onclick: () => send(t) }, t));
    else setTimeout(() => { if (!document.querySelector('.modal-overlay')) document.querySelector('.name-ask input')?.focus(); }, 350);
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
  trackFeature('crisis_shown'); const { node } = addMessage('assistant', text, { crisis: true });
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
  reactToSent(text);

  const crisis = CRISIS_RE.test(text);
  const emergency = EMERGENCY_RE.test(text);
  if (emergency) await emergencyCard();
  // An emergency about someone else does not also need the "I'm glad you told me" card, unless the person is talking about themselves.
  if (crisis && (!emergency || /suicid|kill (my ?self|me)|want(ed)? to die|self[- ]?harm|end (my|it all)/i.test(text))) await crisisCard();

  busy = true; refreshState();
  const speakIt = (!!state.prefs.voiceReplies || convoMode) && voiceSupport.tts;
  try {
    // Guardrails that never depend on a model: medicine questions and "what has NeuroHub written" get vetted answers.
    if (!crisis && !emergency && medicationIntent(text)) { addMessage('assistant', medicationReply()); announce('Phoenix replied'); return; }
    if (!crisis && !emergency && state.prefs.useSite && siteQuestionIntent(text)) {
      await loadSite();
      addMessage('assistant', siteListReply(siteHits(text, 4), state.profile.name)); announce('Phoenix replied'); return;
    }
    if (!crisis && !emergency && reportIntent(text)) {
      const r = reportReply(state.profile.name);
      const { m, node } = addMessage('assistant', r.text, { actions: r.actions }); node.replaceWith(renderMessage(m)); announce('Phoenix replied'); return;
    }
    const mem = !crisis && !emergency ? memoryIntent(text) : null;
    if (mem) {
      const r = memoryReply(mem, state.profile.name);
      if (mem.kind === 'remember' && memoryMode() !== 'off') trackFeature('memory_added');
      const { m, node } = addMessage('assistant', r.text, { actions: r.actions }); node.replaceWith(renderMessage(m)); announce('Phoenix replied'); return;
    }
    if (!crisis && !emergency && checkinIntent(text) && !(aiActive() && aiMaySeeCheckins())) {
      const r = chatReply(state.wellness, state.profile.name);
      const { m, node } = addMessage('assistant', r.text, { actions: r.actions }); node.replaceWith(renderMessage(m)); announce('Phoenix replied'); return;
    }
    if (!aiActive()) {
      if (crisis || emergency) return; // the vetted reply above is the whole answer; nothing clever to add
      const prev = currentChat().messages.filter((m) => m.role === 'assistant').slice(-1)[0]?.content || '';
      await loadSite();
      trackFeature('chat_helper'); trackEmbedChat(); if (compact) trackFeature('float_chat');
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

    // ---- Phoenix AI (NeuroHub's own Claude account; the server enforces the daily limits)
    const d = await loadCrisis();
    const code = guessCountry();
    const block = crisisText(d, d.countries[code] ? code : '').text;
    const small = false; // Phoenix AI is always a capable Claude model, so the small-model safeguards are not needed
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
    const system = buildSystem({ profile: state.profile, prefs: state.prefs, crisisBlock: block, crisisFlag: crisis, activity: compact ? state.float?.activity : '', memoryBlock: memoryBlock(), siteBlock: [topicNotes, sb].filter(Boolean).join('\n\n'), small, wellnessBlock: aiMaySeeCheckins() ? [summaryForAI(state.wellness), assessmentSummaryForAI(state.reports)].filter(Boolean).join('\n') : '' });
    const history = currentChat().messages.filter((m) => !m.crisis && m.content && (m.role === 'user' || m.role === 'assistant')).slice(-20).map(({ role, content }) => ({ role, content }));
    while (history.length && history[0].role !== 'user') history.shift();

    const { m, node } = addMessage('assistant', '…');
    const textEl = node.querySelector('.bubble-text');
    let acc = '';
    abortCtl = new AbortController();
    try {
      trackFeature('chat_ai'); trackEmbedChat(); if (compact) trackFeature('float_chat');
      await streamChat(providerConfig(state), {
        voice: viaVoice || convoMode, // spoken chats are only for signed-in people, and the server checks that too
        system, messages: history, signal: abortCtl.signal, maxTokens: small ? 220 : 1200,
        onText: (delta) => {
          acc += delta;
          if (crisis) return; // in a crisis the reply is held back and checked before anyone sees it
          textEl.innerHTML = fmt(acc); listEl.scrollTop = listEl.scrollHeight;
          talkBurst(); beat();
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
      refreshAiNote(); // update "replies left today"
      if (!crisis) learnSoon();
      m.content = acc || '…'; save();
      reactToReply(acc);
      node.replaceWith(renderMessage(m));
      announce('Phoenix replied');
    } catch (e) {
      const aborted = e?.name === 'AbortError';
      if (aborted) { m.content = acc ? acc + ' …' : '(stopped)'; }
      else {
        console.warn(e);
        trackFeature(e.kind === 'limit' ? 'chat_limit' : 'chat_ai_error');
        m.content = acc ? acc : (e.message || 'I could not reach the AI.');
        if (!acc) m.error = true;
        if (!acc && state.provider.kind === 'shared') {
          // The free shared AI is busy, out for today, or unreachable: never leave the person with nothing. The built-in helper answers.
          try {
            const r = offlineReply(text, { name: state.profile.name, aiConfigured: false, siteHits: state.prefs.useSite ? (q) => siteHits(q, 2) : null });
            m.content = `${e.message}\n\nUntil then, here is what the built-in helper can offer:\n\n${r.text}`; m.error = false; m.actions = (e.kind === 'limit' ? [{ label: '♥ Help cover the cost of Phoenix AI', go: 'donate' }] : []).concat(r.actions || []);
          } catch { /* keep the plain message */ }
        }
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
  if (!requireAccountForVoice()) return; // voice chat is for people with an account
  if (!(await ensureVoiceConsent())) return;
  emptyTurns = 0;
  startListening();
}

function startListening() {
  if (listening || busy) return;
  speaker.stop();
  rec = createRecognizer({
    lang: state.prefs.voiceLang || 'en-GB',
    win: compact ? ui.doc?.defaultView : null,
    onStart: () => { listening = true; refreshState(); announce('Listening'); },
    onInterim: (t) => { inputEl.value = t; reactToSpeech(t); },
    onEnd: ({ text, gotFinal }) => {
      listening = false; refreshState();
      if (gotFinal) { emptyTurns = 0; send(text, { viaVoice: true }); }
      else { emptyTurns++; if ((state.prefs.handsFree || convoMode) && handsFreeActive && emptyTurns < (convoMode ? 3 : 2)) setTimeout(startListening, 600); else { handsFreeActive = false; if (convoMode) endConversation('I did not hear anything, so I stopped listening. Press Talk when you are ready.'); } }
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
  handsFreeActive = !!state.prefs.handsFree || convoMode;
  rec?.start();
}

function stopVoice() { if (convoMode) { convoMode = false; bus.emit('voicechat'); } handsFreeActive = false; rec?.abort(); listening = false; speaker.stop(); refreshState(); }

function maybeRelisten() {
  if (handsFreeActive && (state.prefs.handsFree || convoMode) && lastViaVoice && !speaking && !busy && root?.isConnected) {
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

// ---------------------------------------------------------------- Phoenix writing its own notes (signed-in people who allow it)
/** After every few messages, a small separate request asks Phoenix to jot down anything worth remembering. It never blocks the chat. */
function learnSoon() {
  try {
    if (memoryMode() !== 'auto' || !aiActive()) return;
    state.account.learnCount = (state.account.learnCount || 0) + 1;
    const chat = currentChat();
    if (!shouldLearn(chat)) return;
    state.account.learnCount = 0; save();
    const req = notesRequest(chat);
    streamChat(providerConfig(state), { system: req.system, messages: req.messages, maxTokens: 400, purpose: 'memory' }).then((reply) => {
      const out = parseNotes(reply);
      let added = 0;
      for (const id of out.remove) deleteMemory(id);
      for (const n of out.add) if (addMemory(n, 'ai')) added++;
      if (added) { trackFeature('memory_added'); toast(`Phoenix made ${added === 1 ? 'a note' : added + ' notes'} to remember. See or change them in Settings, Account and memories.`, { icon: '🪶', ms: 4200 }); }
    }).catch(() => { /* notes are a bonus: if it fails, nothing is lost */ });
  } catch { /* never break the chat */ }
}

// ---------------------------------------------------------------- a spoken conversation (the floating Phoenix's Talk button)
export const voiceChatActive = () => convoMode;
/** Starts a spoken conversation: Phoenix listens, replies aloud, and listens again until the person stops it. Follows a button press, or the wake word. */
export async function voiceChatStart({ first = '' } = {}) {
  if (convoMode) return true;
  if (!requireAccountForVoice()) return false;
  if (!voiceSupport.stt) { toast('Talking with Phoenix needs Microsoft Edge, Google Chrome or Safari.', { icon: '🎤', ms: 5000 }); return false; }
  if (!(await ensureVoiceConsent())) return false;
  convoMode = true; emptyTurns = 0; lastViaVoice = true;
  bus.emit('voicechat'); trackFeature('voice_chat');
  handsFreeActive = true;
  if (first && first.length >= 3) send(first, { viaVoice: true }); // "Hey Phoenix, I feel overwhelmed": what came after her name is the first thing said
  else startListening();
  return true;
}
export function voiceChatStop() { if (!convoMode) return; endConversation(''); }
function endConversation(message) {
  convoMode = false; stopVoice(); lastViaVoice = false;
  if (message) toast(message, { icon: '🎤', ms: 4200 });
  bus.emit('voicechat');
}

// signing out ends any spoken conversation straight away, and the mic buttons say what they need
bus.on('account', () => { if (!voiceAllowed()) { if (convoMode) endConversation(''); else stopVoice(); } if (micBtn) micBtn.setAttribute('aria-label', voiceAllowed() ? 'Speak to Phoenix' : 'Speak to Phoenix (needs a free account)'); });
