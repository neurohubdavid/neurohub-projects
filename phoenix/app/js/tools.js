// The Toolkit: small, useful things that work with no AI and no internet.
// Breathing, grounding, sensory reset, energy check-in, focus timer (body-double style), task breaker, scripts and a
// personal support plan. The task breaker uses the connected AI when there is one and falls back to a built-in method.
import { el, fmt, toast, announce, prefersReducedMotion, copyText, download, fmtDate, fmtTime, clamp, uid, dayKey } from './util.js';
import { phoenixSVG, setPhoenixState } from './mascot.js';
import { state, save, aiActive } from './store.js';
import { checkinAdvice, offlineTaskSteps, scripts } from './offline.js';
import { buildSystem } from './persona.js';
import { streamChat, providerConfig } from './providers.js';
import { prefillChat } from './chat.js';

let cleanup = null;
const onLeave = (fn) => { cleanup = fn; };
export function leaveTools() { try { cleanup?.(); } catch { /* ignore */ } cleanup = null; }

const TOOLS = [
  { id: 'breathing', icon: '🌬️', title: 'Breathing', blurb: 'A slow pacer to settle your body. No counting needed.' },
  { id: 'grounding', icon: '🌿', title: 'Grounding', blurb: 'Come back to the room through your senses.' },
  { id: 'sensory', icon: '🎧', title: 'Sensory reset', blurb: 'Pick what is too much and get ideas for it.' },
  { id: 'checkin', icon: '📈', title: 'Energy check-in', blurb: 'Log energy, sensory load and mood, and see your patterns.' },
  { id: 'focus', icon: '⏱️', title: 'Focus with Phoenix', blurb: 'A gentle timer with company, for starting and staying on task.' },
  { id: 'tasks', icon: '✅', title: 'Task breaker', blurb: 'Turn something big into tiny steps.' },
  { id: 'scripts', icon: '💬', title: 'Scripts and messages', blurb: 'Ready wording for saying no, asking for adjustments and more.' },
  { id: 'plan', icon: '🛟', title: 'My support plan', blurb: 'Write down what helps, so you do not have to explain it in a crisis.' },
];

export function mountToolkit(container, { navigate, tool = 'home' }) {
  leaveTools();
  container.textContent = '';
  container.classList.remove('chat-view');
  const back = () => el('button', { class: 'btn btn-ghost btn-sm back', onclick: () => navigate('tool:home') }, '← Toolkit');
  if (tool === 'home' || !TOOLS.some((t) => t.id === tool)) {
    container.append(el('div', { class: 'view-title' }, el('h1', {}, 'Toolkit')),
      el('p', { class: 'muted' }, 'Everything here works without an AI and without internet. Take what helps.'),
      el('div', { class: 'grid' }, TOOLS.map((t) => el('button', { class: 'card tile', onclick: () => navigate('tool:' + t.id) },
        el('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon), el('strong', {}, t.title), el('span', { class: 'muted small' }, t.blurb)))));
    return;
  }
  const meta = TOOLS.find((t) => t.id === tool);
  const body = el('div', { class: 'stack' });
  container.append(back(), el('div', { class: 'view-title' }, el('span', { 'aria-hidden': 'true', style: { fontSize: '2rem' } }, meta.icon), el('h1', {}, meta.title)), body);
  ({ breathing, grounding, sensory, checkin, focus, tasks, scriptsTool, plan }[tool === 'scripts' ? 'scriptsTool' : tool])(body, { navigate });
}

// ---------------------------------------------------------------- breathing
function breathing(body) {
  const patterns = {
    calm: { label: 'Calm: in 4, out 6', steps: [['Breathe in', 4], ['Breathe out', 6]] },
    box: { label: 'Box: 4 in, 4 hold, 4 out, 4 hold', steps: [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]] },
    gentle: { label: 'Gentle: in 3, out 3', steps: [['Breathe in', 3], ['Breathe out', 3]] },
  };
  let key = 'calm', timer = null, running = false, cycles = 0;
  const orb = el('div', { class: 'breath-orb', role: 'img', 'aria-label': 'Breathing guide' }, 'Ready');
  const count = el('div', { class: 'breath-count', 'aria-live': 'off' }, '');
  const info = el('p', { class: 'muted', 'aria-live': 'polite' }, 'Press start. If counting stresses you, just follow the circle, or close your eyes and follow the words.');
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Pattern' });
  const drawSeg = () => { seg.textContent = ''; for (const [k, p] of Object.entries(patterns)) seg.append(el('button', { 'aria-pressed': String(k === key), onclick: () => { key = k; stop(); drawSeg(); } }, p.label)); };
  const startBtn = el('button', { class: 'btn btn-primary btn-lg', onclick: () => (running ? stop() : start()) }, 'Start');
  function stop() { running = false; clearTimeout(timer); orb.style.transform = ''; orb.textContent = 'Ready'; count.textContent = ''; startBtn.textContent = 'Start'; info.textContent = cycles ? `${cycles} slow breath${cycles === 1 ? '' : 's'}. Well done. Go again any time.` : 'Press start.'; cycles = 0; }
  function start() {
    running = true; cycles = 0; startBtn.textContent = 'Stop';
    const steps = patterns[key].steps; let i = 0;
    const run = () => {
      if (!running) return;
      const [label, secs] = steps[i % steps.length];
      orb.textContent = label;
      if (!prefersReducedMotion()) { orb.style.transitionDuration = secs + 's'; orb.style.transform = /in/i.test(label) ? 'scale(1.4)' : /out/i.test(label) ? 'scale(1)' : orb.style.transform || 'scale(1)'; }
      let left = secs; count.textContent = String(left);
      const tick = () => { if (!running) return; left--; if (left > 0) { count.textContent = String(left); timer = setTimeout(tick, 1000); } else { if (i % steps.length === steps.length - 1) cycles++; i++; run(); } };
      timer = setTimeout(tick, 1000);
    };
    run();
  }
  onLeave(() => { running = false; clearTimeout(timer); });
  drawSeg();
  body.append(seg, el('div', { class: 'breath' }, orb, count, startBtn), info);
}

// ---------------------------------------------------------------- grounding
function grounding(body) {
  const steps = [
    ['5', 'things you can see', 'Look around slowly. Name them in your head or out loud. Colours and shapes count.'],
    ['4', 'things you can feel', 'Your feet on the floor, your clothes, the chair, something in your hand. Press your hands together.'],
    ['3', 'things you can hear', 'Near sounds and far sounds. If it is quiet, listen to the quiet, or your own breathing.'],
    ['2', 'things you can smell', 'Or two smells you like. Your sleeve, a drink, a memory of a smell is fine.'],
    ['1', 'thing you can taste', 'Or take a sip of water and notice it. Or think of one taste you love.'],
  ];
  let i = 0;
  const box = el('div', { class: 'card', style: { textAlign: 'center' } });
  const draw = () => {
    box.textContent = '';
    if (i >= steps.length) { box.append(el('h2', {}, 'You are here.'), el('p', {}, 'Notice how your body feels now compared with when you started. Any change, even small, counts. You can go round again, or stop.'), el('div', { class: 'row', style: { justifyContent: 'center' } }, el('button', { class: 'btn', onclick: () => { i = 0; draw(); } }, 'Again'), el('button', { class: 'btn btn-primary', onclick: () => { announce('Done'); } }, 'I am done'))); return; }
    const [n, what, tip] = steps[i];
    box.append(el('div', { class: 'timer-face', 'aria-hidden': 'true' }, n), el('h2', {}, what), el('p', { class: 'muted' }, tip),
      el('p', { class: 'muted small' }, 'You can skip any sense that is hard or does not feel good today.'),
      el('div', { class: 'row', style: { justifyContent: 'center' } },
        i > 0 ? el('button', { class: 'btn btn-ghost', onclick: () => { i--; draw(); } }, 'Back') : null,
        el('button', { class: 'btn btn-primary', onclick: () => { i++; draw(); } }, i === steps.length - 1 ? 'Finish' : 'Next')));
  };
  draw();
  body.append(el('p', { class: 'muted' }, 'A gentle way back to the present. Go at your own speed.'), box);
}

// ---------------------------------------------------------------- sensory reset
function sensory(body) {
  const ideas = {
    'Light': ['Dim or turn off the big light, use a lamp or a screen in dark mode.', 'Sunglasses, a cap, or close your eyes for a minute.', 'Face away from screens and windows.'],
    'Sound': ['Earplugs, noise-cancelling headphones, or your own steady music or white noise.', 'Move to a quieter room or corridor, even for five minutes.', 'Cover your ears with your hands for a moment. It is allowed.'],
    'Touch and clothes': ['Change into something soft, or take off the thing that itches or squeezes.', 'Deep pressure: a firm squeeze, a weighted blanket, lying under something heavy, or hugging a cushion.', 'Hold something with a texture you like.'],
    'Smell': ['Open a window, or move to fresh air.', 'Breathe into a sleeve or scarf that smells like you or home.', 'Use a scent you like (a small thing to smell), if that helps.'],
    'Crowd or people': ['Step away, even to the toilet, for a few minutes.', 'Tell one person “I need a break”, or send a message so you do not have to speak.', 'Find a corner, a wall to lean on, or go outside.'],
    'Demands and questions': ['Ask for a pause: “I need a minute before I can answer.”', 'Turn off notifications. You do not have to reply right now.', 'List what actually has to happen today, and tick off the rest as “not today”.'],
    'Hungry or thirsty': ['Water first, then something small you can eat. Safe foods are fine.', 'Set a phone alarm to remind you to eat and drink.'],
    'Hot or cold': ['Add or take off a layer, cold water on your wrists, a warm drink or a heat pack.', 'Change rooms.'],
    'Too still or bored': ['Movement: walk, pace, stretch, bounce, dance.', 'Something absorbing: your interest, a puzzle, a show you know well.', 'Music with a beat, or a fidget.'],
  };
  const picked = new Set();
  const out = el('div', { class: 'stack' });
  const draw = () => {
    out.textContent = '';
    if (!picked.size) { out.append(el('p', { class: 'muted' }, 'Choose what feels like too much (or too little) right now.')); return; }
    for (const k of picked) out.append(el('div', { class: 'card' }, el('h3', {}, k), el('ul', {}, ideas[k].map((t) => el('li', {}, t)))));
    out.append(el('div', { class: 'notice' }, 'Whatever you try, you are allowed to leave, be quiet and stop. If you can, go to your nest: your quiet place with your comfort things.'));
  };
  const tags = el('div', { class: 'tags', role: 'group', 'aria-label': 'What is too much' }, Object.keys(ideas).map((k) => {
    const b = el('button', { class: 'tag', 'aria-pressed': 'false', onclick: () => { picked.has(k) ? picked.delete(k) : picked.add(k); b.setAttribute('aria-pressed', String(picked.has(k))); draw(); } }, k);
    return b;
  }));
  draw();
  body.append(el('p', { class: 'muted' }, 'A sensory reset works on the input, not on you. Pick everything that applies.'), tags, out);
}

// ---------------------------------------------------------------- check-in
function checkin(body) {
  const fields = [
    ['energy', 'Energy', 'Empty', 'Full'],
    ['sensory', 'Sensory load', 'Calm', 'Overloaded'],
    ['social', 'Social load', 'Fine', 'Drained'],
    ['mood', 'Mood', 'Low', 'Good'],
  ];
  const vals = { energy: 3, sensory: 3, social: 3, mood: 3 };
  const sliders = fields.map(([k, label, lo, hi]) => {
    const out = el('span', { class: 'chip' }, '3');
    const input = el('input', { type: 'range', class: 'range', min: '1', max: '5', step: '1', value: '3', id: 'ci-' + k, 'aria-label': `${label}, 1 is ${lo}, 5 is ${hi}` });
    input.addEventListener('input', () => { vals[k] = Number(input.value); out.textContent = input.value; });
    return el('div', {}, el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('label', { for: 'ci-' + k }, el('strong', {}, label)), out), input, el('div', { class: 'scale-labels' }, el('span', {}, lo), el('span', {}, hi)));
  });
  const note = el('textarea', { class: 'input', rows: '2', placeholder: 'Anything to add? (optional)', 'aria-label': 'Note', maxlength: '300' });
  const adviceBox = el('div', { class: 'notice good', hidden: true });
  const hist = el('div', { class: 'stack' });
  const drawHist = () => {
    hist.textContent = '';
    const list = state.checkins.slice(-14);
    if (!list.length) return;
    const bars = el('div', { class: 'bars', role: 'img', 'aria-label': `Energy over your last ${list.length} check-ins` }, list.map((c) => el('div', { class: 'bar', style: { height: (c.energy / 5) * 100 + '%' }, title: `${fmtDate(c.ts, { day: 'numeric', month: 'short' })}: energy ${c.energy}` })));
    hist.append(el('h3', {}, 'Your energy lately'), bars, el('div', { style: { height: '1rem' } }),
      el('div', { class: 'stack' }, state.checkins.slice(-5).reverse().map((c) => el('div', { class: 'help-line' },
        el('div', { style: { flex: 1 } }, el('strong', {}, `${fmtDate(c.ts, { day: 'numeric', month: 'short' })} ${fmtTime(c.ts)}`), el('div', { class: 'muted small' }, `Energy ${c.energy} · Sensory ${c.sensory} · Social ${c.social} · Mood ${c.mood}${c.note ? ' · ' + c.note : ''}`)),
        el('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Delete this check-in', onclick: () => { state.checkins = state.checkins.filter((x) => x !== c); save(); drawHist(); } }, 'Delete')))));
  };
  const saveBtn = el('button', { class: 'btn btn-primary', onclick: () => {
    state.checkins.push({ ts: Date.now(), ...vals, note: note.value.trim() });
    state.checkins = state.checkins.slice(-400);
    save(); note.value = '';
    adviceBox.hidden = false; adviceBox.textContent = ''; adviceBox.append(el('div', { html: fmt(checkinAdvice(vals)) }));
    drawHist(); toast('Saved on this device', { icon: '📈', ms: 1600 });
  } }, 'Save check-in');
  drawHist();
  body.append(el('p', { class: 'muted' }, 'How is it right now? Your answers stay on this device.'), ...sliders, note, el('div', { class: 'row' }, saveBtn), adviceBox, hist);
}

// ---------------------------------------------------------------- focus
function chime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, now + i * 0.22); g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.22 + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + 0.9);
      o.start(now + i * 0.22); o.stop(now + i * 0.22 + 1);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch { /* audio blocked: silent is fine */ }
}
function focus(body) {
  let mins = 25, remaining = 25 * 60, endAt = 0, timer = null, running = false;
  const mascot = phoenixSVG(4); mascot.style.setProperty('--ph-size', '90px');
  const face = el('div', { class: 'timer-face', role: 'timer', 'aria-live': 'off' }, '25:00');
  const what = el('input', { class: 'input', placeholder: 'What are you going to do? Make it tiny, like “open the document”.', 'aria-label': 'What are you doing', maxlength: '120' });
  const msg = el('p', { class: 'muted', 'aria-live': 'polite', style: { textAlign: 'center' } }, 'Phoenix will sit with you. You do not have to talk.');
  const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const render = () => { face.textContent = fmtT(Math.max(0, remaining)); };
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Length' });
  const drawSeg = () => { seg.textContent = ''; for (const m of [5, 10, 25, 45]) seg.append(el('button', { 'aria-pressed': String(m === mins), onclick: () => { if (running) return; mins = m; remaining = m * 60; drawSeg(); render(); } }, `${m} min`)); };
  const btn = el('button', { class: 'btn btn-primary btn-lg', onclick: () => (running ? pause() : go()) }, 'Start');
  const reset = el('button', { class: 'btn btn-ghost', onclick: () => { pause(); remaining = mins * 60; render(); msg.textContent = 'Ready when you are.'; } }, 'Reset');
  function pause() { running = false; clearInterval(timer); setPhoenixState(mascot, 'idle'); btn.textContent = remaining < mins * 60 && remaining > 0 ? 'Resume' : 'Start'; }
  function go() {
    running = true; endAt = Date.now() + remaining * 1000; btn.textContent = 'Pause'; setPhoenixState(mascot, 'thinking');
    msg.textContent = what.value.trim() ? `Just this: ${what.value.trim()}. Phoenix is here.` : 'Phoenix is here. Just start.';
    timer = setInterval(() => {
      remaining = Math.round((endAt - Date.now()) / 1000); render();
      if (remaining <= 0) { pause(); remaining = 0; render(); setPhoenixState(mascot, 'happy'); btn.textContent = 'Go again'; remaining = mins * 60; msg.textContent = 'Time. You showed up, and that counts. Drink some water, stretch, and rest or go again.'; if (state.prefs.focusChime) chime(); announce('Focus time finished'); }
    }, 500);
  }
  const chimeBox = el('label', { class: 'switch' }, el('input', { type: 'checkbox', checked: !!state.prefs.focusChime }), el('span', {}, 'Soft chime at the end'));
  chimeBox.querySelector('input').addEventListener('change', (e) => { state.prefs.focusChime = e.target.checked; save(); });
  onLeave(() => { running = false; clearInterval(timer); });
  drawSeg(); render();
  body.append(el('p', { class: 'muted' }, 'Body doubling: working alongside someone helps many people start and stay on task. This is a small, quiet version.'),
    el('div', { style: { textAlign: 'center' } }, mascot), face, el('div', { style: { textAlign: 'center' } }, seg), what,
    el('div', { class: 'row', style: { justifyContent: 'center' } }, btn, reset), msg, chimeBox);
}

// ---------------------------------------------------------------- task breaker
function parseSteps(text) {
  return text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim()).filter((l) => l.length > 2 && !/^(here|sure|okay|ok)\b.*:$/i.test(l)).slice(0, 12);
}
function tasks(body) {
  let energy = 'medium';
  const input = el('input', { class: 'input', placeholder: 'What is the thing? (for example: reply to the landlord)', 'aria-label': 'Task', maxlength: '200' });
  const seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Your energy right now' });
  const drawSeg = () => { seg.textContent = ''; for (const e of ['low', 'medium', 'high']) seg.append(el('button', { 'aria-pressed': String(e === energy), onclick: () => { energy = e; drawSeg(); } }, e[0].toUpperCase() + e.slice(1) + ' energy')); };
  const status = el('p', { class: 'muted', 'aria-live': 'polite' });
  const list = el('div', { class: 'stack' });
  const go = el('button', { class: 'btn btn-primary', onclick: async () => {
    const title = input.value.trim(); if (!title) { input.focus(); return; }
    go.disabled = true; let steps = null;
    if (aiActive()) {
      status.textContent = 'Asking your connected AI…';
      try {
        const system = buildSystem({ profile: state.profile, prefs: { ...state.prefs, replyLength: 'short' } }) +
          `\n\nTASK MODE: Break the task into 4 to 8 tiny, concrete steps for a neurodivergent person with ${energy} energy right now. The first step must take under two minutes and must not need any decision. One step per line, numbered. No introduction and no closing remarks. Do not shame or hurry. Never include steps that are risky.`;
        const reply = await streamChat(providerConfig(state), { system, messages: [{ role: 'user', content: `Task: ${title}` }], maxTokens: 500 });
        const parsed = parseSteps(reply); if (parsed.length >= 3) steps = parsed;
      } catch (e) { toast(e.message || 'The AI could not answer, so I used the built-in method.', { icon: 'ℹ️', ms: 4200 }); }
    }
    if (!steps) steps = offlineTaskSteps(title, energy);
    state.tasks.unshift({ id: uid(), title, created: Date.now(), steps: steps.map((text) => ({ text, done: false })) });
    state.tasks = state.tasks.slice(0, 30); save();
    input.value = ''; status.textContent = aiActive() ? '' : 'Built-in steps. Switch on Phoenix AI in Settings for steps that fit your exact task.';
    go.disabled = false; draw();
  } }, 'Break it down');
  const draw = () => {
    list.textContent = '';
    for (const t of state.tasks) {
      const done = t.steps.filter((s) => s.done).length;
      list.append(el('div', { class: 'card' },
        el('div', { class: 'row', style: { justifyContent: 'space-between' } }, el('h3', { style: { margin: 0 } }, t.title), el('span', { class: 'chip' }, `${done}/${t.steps.length}`)),
        el('ul', { class: 'steps', style: { marginTop: '.8rem' } }, t.steps.map((s) => {
          const cb = el('input', { type: 'checkbox', checked: s.done, 'aria-label': s.text });
          const li = el('li', { class: s.done ? 'done' : '' }, cb, el('span', { class: 't' }, s.text));
          cb.addEventListener('change', () => { s.done = cb.checked; li.classList.toggle('done', s.done); save(); draw(); });
          return li;
        })),
        el('div', { class: 'row', style: { marginTop: '.8rem' } },
          el('button', { class: 'btn btn-sm', onclick: async () => toast((await copyText(t.steps.map((s, i) => `${i + 1}. ${s.text}`).join('\n'))) ? 'Copied' : 'Could not copy', { ms: 1400 }) }, 'Copy'),
          el('button', { class: 'btn btn-ghost btn-sm', onclick: () => { state.tasks = state.tasks.filter((x) => x !== t); save(); draw(); } }, 'Delete'))));
    }
  };
  drawSeg(); draw();
  body.append(el('p', { class: 'muted' }, 'Big things are hard to start. Tiny things are not. Tell me the thing and how much energy you have.'), input, seg, el('div', { class: 'row' }, go), status, list);
}

// ---------------------------------------------------------------- scripts
function scriptsTool(body, { navigate }) {
  body.append(el('p', { class: 'muted' }, 'Ready-made wording. Copy it and change it to fit. You do not have to explain more than you want to.'));
  const ai = (label, prompt) => el('button', { class: 'btn btn-sm', onclick: () => {
    if (!aiActive()) { toast('This works best with an AI connected. Opening AI settings.', { icon: 'ℹ️', ms: 3200 }); navigate('settings:ai'); return; }
    navigate('chat'); prefillChat(prompt);
  } }, label);
  body.append(el('div', { class: 'card' }, el('h3', {}, 'With an AI connected'),
    el('div', { class: 'row' },
      ai('Decode a message for me', 'Here is a message I received. Please tell me plainly what it probably means, what they may want from me, and whether I have to reply. The message: '),
      ai('Help me write a reply', 'Please help me write a short, clear reply. What I want to say, and to whom: '),
      ai('Help me ask for adjustments', 'Please help me write a request for adjustments at work or school. My situation and what would help: '))));
  for (const s of scripts) {
    body.append(el('div', { class: 'card script' }, el('div', { style: { flex: '1 1 20rem' } }, el('h3', { style: { margin: 0 } }, s.title), el('p', {}, s.text)),
      el('div', { class: 'row' },
        el('button', { class: 'btn btn-sm btn-primary', onclick: async () => toast((await copyText(s.text)) ? 'Copied' : 'Could not copy', { icon: '📋', ms: 1400 }) }, 'Copy'),
        el('button', { class: 'btn btn-sm', onclick: () => {
          if (!aiActive()) { toast('Switch on Phoenix AI to tailor this. Opening AI settings.', { icon: 'ℹ️', ms: 3200 }); navigate('settings:ai'); return; }
          navigate('chat'); prefillChat(`Please help me adapt this wording for my situation: "${s.text}"\n\nMy situation: `);
        } }, 'Tailor with Phoenix'))));
  }
}

// ---------------------------------------------------------------- support plan
function plan(body) {
  const fields = [
    ['signs', 'Early signs that I am getting overloaded', 'For example: I go quiet, I stim more, I get irritable, noise starts to hurt, I cannot find words.'],
    ['helps', 'What helps me', 'For example: a quiet dark room, headphones, deep pressure, a drink, being left alone, someone sitting near me without talking.'],
    ['avoid', 'What makes it worse', 'For example: being touched, being asked questions, being rushed, bright lights, being told to calm down.'],
    ['tell', 'Who to tell, and how to reach them', 'Names and how they can help (text, call, come over).'],
    ['say', 'What I want people to say or do', 'For example: “Take your time. Do you want quiet or company?” One sentence is enough.'],
  ];
  const inputs = fields.map(([k, label, hint]) => {
    const t = el('textarea', { class: 'input', rows: '3', maxlength: '800' }); t.value = state.plan[k] || '';
    t.addEventListener('input', () => { state.plan[k] = t.value; save(); });
    return el('label', { class: 'field' }, label, el('span', { class: 'hint' }, hint), t);
  });
  const text = () => `MY SUPPORT PLAN\n\n${fields.map(([k, label]) => `${label.toUpperCase()}\n${state.plan[k] || '(not filled in)'}`).join('\n\n')}\n`;
  body.append(el('p', { class: 'muted' }, 'Write this when you are calm, so that when you are not, you and the people around you already have the answers. It saves on this device as you type.'),
    ...inputs,
    el('div', { class: 'row' },
      el('button', { class: 'btn btn-primary', onclick: async () => toast((await copyText(text())) ? 'Copied. Paste it into a message or note.' : 'Could not copy', { ms: 1800 }) }, 'Copy'),
      el('button', { class: 'btn', onclick: () => download(`my-support-plan-${dayKey()}.txt`, text()) }, 'Download as text'),
      el('button', { class: 'btn btn-ghost', onclick: () => window.print() }, 'Print')));
}
