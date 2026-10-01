// Phoenix's built-in helper: works with no AI, no internet and no setup. It is rule-based, so it is honest about
// being limited: it listens for what you said, answers from the built-in knowledge, points to tools, and offers to
// connect a real AI for open conversation. Pure functions, no DOM, so it can be tested in Node.
import { KB, SCRIPTS } from './kb.js';

const norm = (s) => ' ' + String(s || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' -]/g, ' ').replace(/\s+/g, ' ') + ' ';

/** Finds the best knowledge entry for a question, or null. Longer phrase matches win. */
export function findTopic(question) {
  const q = norm(question);
  let best = null;
  for (const e of KB) {
    for (const term of e.terms) {
      const t = norm(term);
      if (t.trim().length < 3) { if (t.trim() && q.includes(t)) { if (!best || 3 > best.len) best = { e, len: 3 }; } continue; }
      if (q.includes(t) && (!best || t.trim().length > best.len)) best = { e, len: t.trim().length };
    }
  }
  return best?.e || null;
}

const bullets = (arr) => arr.map((x) => `- ${x}`).join('\n');

export function topicReply(e) {
  return `**${e.title}**\n\n${e.what}\n\n${e.why}\n\n**What tends to help:** ${e.helps}`;
}

const askedAbout = /^(what|whats|what's|who|why|how|explain|tell me|define|meaning|can you explain|do you know|is|are|does|do)\b|\?|\b(mean|means|meaning|about|explain|define)\b/;

/**
 * Returns { text, actions } where actions are buttons the interface can show:
 * { label, go } and go is one of 'tool:breathing', 'tool:grounding', 'tool:sensory', 'tool:checkin', 'tool:focus',
 * 'tool:tasks', 'tool:scripts', 'tool:plan', 'learn', 'settings:ai', 'help'.
 */
export function offlineReply(question, { name = '', aiConfigured = false, lastAssistant = '', siteHits = null } = {}) {
  const raw = String(question || '').trim();
  const q = norm(raw);
  const hi = name ? `${name}. ` : '';
  const A = (label, go) => ({ label, go });
  const links = () => {
    const h = siteHits ? siteHits(raw) : [];
    const web = h.filter((x) => x.kind !== 'presentation' && x.kind !== 'transcript' && x.url), decks = [...new Set(h.filter((x) => x.kind === 'presentation').map((x) => x.deck))].slice(0, 2);
    return (web.length ? '\n\n**From neurohubcommunity.org:**\n' + web.map((x) => `- [${x.title}](${x.url})`).join('\n') : '') + (decks.length ? '\n\n**Also covered in NeuroHub presentations:**\n' + decks.map((d) => `- ${d}`).join('\n') : '');
  };

  if (!raw) return { text: 'I am here whenever you want to say something.', actions: [] };

  if (/^\s*(hi|hello|hey|hiya|good (morning|afternoon|evening)|yo)\b/.test(q) && q.trim().split(' ').length <= 4)
    return { text: `Hello${name ? ' ' + name : ''}. I'm Phoenix. How are you doing right now? You can answer in one word if that is all you have.`, actions: [A('Check in with my energy', 'tool:checkin'), A('I need to calm down', 'tool:breathing')] };

  if (/^\s*(thanks|thank you|cheers|ta|thx)\b/.test(q)) return { text: 'You are welcome. Go at your own pace, and rest whenever you need to.', actions: [] };

  if (/(who|what) are you|are you (an? )?(ai|bot|robot|real|human|person)|are you a therapist/.test(q))
    return { text: `I am Phoenix, a neuro-affirming AI assistant made by NeuroHub Community, an Autistic-led organisation. I am a computer program, not a person and not a therapist. Right now Phoenix AI is switched off, so I am running as the built-in helper: I can answer from my own notes and point you to tools, but I cannot hold a free-flowing conversation. Switch on Phoenix AI in Settings and I can.`, actions: [A('Switch on Phoenix AI', 'settings:ai')] };

  if (/(what can you do|how (do|can) you help|what do you do|help me$|^help$|what is this)/.test(q))
    return { text: `Here is what I can do:\n${bullets([
      'Explain words and ideas like masking, burnout, monotropism or RSD. Just ask, for example “what is masking?”.',
      'Help you calm down: breathing, grounding and a sensory reset.',
      'Help you get started on something by breaking it into tiny steps.',
      'Give you wording for hard messages: saying no, asking for adjustments, leaving early.',
      'Track your energy so you can spot patterns.',
    ])}\n\nIf you switch on Phoenix AI in Settings, I can also talk things through with you freely.`, actions: [A('Open the Toolkit', 'tool:home'), A('Learn', 'learn'), A('Switch on Phoenix AI', 'settings:ai')] };

  if (/(connect|set ?up|enable|turn on|use).{0,20}\b(ai|ollama|gemini|claude|groq|model)\b|\bhow (do|can) i (get|connect)/.test(q))
    return { text: 'Phoenix AI is free and needs no setup. You can switch it on in Settings. NeuroHub Community pays for every reply, so if you can, a donation helps keep it live.', actions: [A('Open AI settings', 'settings:ai'), A('Donate', 'donate')] };

  // Only when they say it about themselves ("I feel overwhelmed"), not when asking about a topic ("what is burnout").
  const selfSpeak = /\b(i|i'm|im|i am|i feel|i've|ive|feeling|feel|so|too|really|very|my head|it's all)\b/.test(q);
  const asksDefinition = /^\s*(what|whats|what's|why|how|explain|tell me|define|can you explain)\b/.test(q);
  const distress = /(overwhelm|overload|shut ?down|melt ?down|melting|meltdown|too much|can't cope|cant cope|panic|panicking|spiral|spiralling|freaking out|sensory)/.test(q);
  if (selfSpeak && distress && !asksDefinition)
    return { text: `${hi}That sounds like a lot. You do not have to fix anything, explain anything or answer me. It is fine to stop.\n\nIf you want something small: less input if you can (quieter, dimmer, softer), something that regulates you (stimming, pressure, warmth, a drink), and no decisions for a bit.`, actions: [A('Breathing', 'tool:breathing'), A('Sensory reset', 'tool:sensory'), A('Grounding', 'tool:grounding')] };

  if (selfSpeak && /(exhaust|drained|worn out|so tired|no energy|burnt out|burned out|low on spoons|no spoons|running on empty)/.test(q) && !asksDefinition)
    return { text: `${hi}That sounds really draining. Being this tired is real information, not weakness. If you can, take something off your list today, and put rest on it as if it were a task.\n\nWould it help to log your energy so we can see what is costing you the most?`, actions: [A('Log my energy', 'tool:checkin'), A('Sensory reset', 'tool:sensory')] };

  if (selfSpeak && /(can't start|cant start|cannot start|can't get started|cant get started|stuck|frozen|procrastinat|avoiding|can't make myself|cant make myself|can't focus|cant focus|paralys|don't know where to start|dont know where to start)/.test(q) && !asksDefinition)
    return { text: `${hi}That wall is real, and it is not laziness. Let's make the first step so small it is almost silly: just open the thing, or put one item where it belongs, and stop there if you want.\n\nI can break your task into tiny steps, or keep you company with a short focus timer.`, actions: [A('Break my task down', 'tool:tasks'), A('Focus timer (I’ll stay with you)', 'tool:focus')] };

  if (selfSpeak && /(anxious|anxiety|worried|scared|nervous|afraid|dread|on edge)/.test(q) && !asksDefinition)
    return { text: `${hi}That sounds uncomfortable. I am sorry you are carrying it. If you want to tell me what is behind it, I will listen. If you would rather do something to settle your body first, these can help.`, actions: [A('Breathing', 'tool:breathing'), A('Grounding', 'tool:grounding'), A('Talk it over with Phoenix AI', 'settings:ai')] };

  if (selfSpeak && /(sad|down|low|lonely|alone|depressed|unhappy|crying|numb|empty)/.test(q) && !asksDefinition)
    return { text: `${hi}I am sorry it is like that. You do not have to say more than you want to. Feeling low or lonely is part of being human, and it is a lot harder when the world is not built for you.\n\nIf it has been heavy for a while, please tell someone you trust or a professional who understands neurodivergence. If it ever feels like too much, the red Help button is always there.`, actions: [A('Get help now', 'help'), A('Sensory reset', 'tool:sensory')] };

  if (selfSpeak && /(angry|furious|rage|frustrated|annoyed|irritated)/.test(q) && !asksDefinition)
    return { text: `${hi}That is a valid thing to feel. Anger often tells us a need or a boundary has been crossed. If it is big right now, moving your body or getting away from input can help before thinking about what to do.\n\nWhen you are ready, we can work out what you need.`, actions: [A('Breathing', 'tool:breathing'), A('Sensory reset', 'tool:sensory')] };

  if (/(how (do|can|should) i (say|tell|ask|explain|word|phrase|reply|respond|decline|refuse)|what (do|should) i say|say no|turn down|decline|write (a |an )?(email|message|text|reply)|reply to|respond to|ask (for|my (boss|manager|teacher|work))|reasonable adjustment|accommodation)/.test(q) && !findTopic(raw))
    return { text: 'Wording for hard messages is one of the things a real AI is best at, because it can tailor it to your situation. Meanwhile there is a set of ready-made scripts you can copy and change: saying no, asking for more time, asking for adjustments, leaving early.', actions: [A('Open scripts', 'tool:scripts'), A('Use Phoenix AI to tailor them', 'settings:ai')] };

  if (/(what should i do|what now|what next|i don't know what to do|dont know what to do|no idea what to do|where do i start)/.test(q))
    return { text: `${hi}A gentle way to choose: how is your energy right now, low, medium or high?\n\n- **Low:** do the smallest useful thing, or rest. Rest counts.\n- **Medium:** pick one thing and break it into tiny steps.\n- **High:** do the thing that matters most first, and set a timer so you remember to eat and drink.\n\nWould you like help with any of these?`, actions: [A('Log my energy', 'tool:checkin'), A('Break a task down', 'tool:tasks'), A('Focus timer', 'tool:focus')] };

  const topic = findTopic(raw);
  if (topic && (askedAbout.test(q) || q.trim().split(' ').length <= 4 || !selfSpeak))
    return { text: topicReply(topic) + links(), actions: [A('Learn more topics', 'learn')] };
  if (topic) return { text: `${hi}Thank you for telling me. ${topic.what}\n\n**What tends to help:** ${topic.helps}`, actions: [A('Learn more topics', 'learn')] };

  const found = links();
  if (found) return { text: `${hi}That is not in my own notes, but NeuroHub Community has written about something close:${found}${aiConfigured ? '' : '\n\nIf you switch on Phoenix AI in Settings, I can talk it through with you as well.'}`, actions: aiConfigured ? [A('Learn', 'learn')] : [A('Switch on Phoenix AI', 'settings:ai'), A('Learn', 'learn')] };
  const suggestions = ['masking', 'burnout', 'meltdowns and shutdowns', 'stimming', 'monotropism', 'executive function', 'rejection sensitivity', 'sensory overload'];
  return {
    text: `${hi}I am not sure I have understood. As the built-in helper I can only answer from my own notes, so I cannot have a free conversation about that.\n\nYou can ask me about a topic, for example: ${suggestions.slice(0, 5).map((s) => `“${s}”`).join(', ')}.${aiConfigured ? '' : '\n\nIf you switch on Phoenix AI in Settings, I can talk about anything with you.'}`,
    actions: aiConfigured ? [A('Learn', 'learn')] : [A('Switch on Phoenix AI', 'settings:ai'), A('Learn', 'learn')],
  };
}

/** Simple, kind task breakdown used when no AI is connected. Generic on purpose: it does not pretend to understand the task. */
export function offlineTaskSteps(task, energy = 'medium') {
  const t = String(task || '').trim().replace(/[.!?]+$/, '') || 'the task';
  const start = [
    `Get comfortable and take a sip of water. This counts as step one.`,
    `Gather only what you need for “${t}” and put it where you can see it.`,
    `Do the tiniest first piece of it for two minutes. Just two.`,
  ];
  const middle = [
    `Decide what “good enough” looks like for “${t}” and write it in one line.`,
    `Do the next smallest piece. If it is still big, cut it in half.`,
    `Take a short break: move, stim, or get a drink.`,
    `Go back for one more short round.`,
  ];
  const end = [
    `Stop at a point where you know what comes next, and write that next step down.`,
    `Tidy up just one thing, then reward yourself with something that feels good.`,
  ];
  if (energy === 'low') return [...start, `If your energy allows, do one more short round. Otherwise stop, and know that starting counted.`, end[0]];
  if (energy === 'high') return [...start, ...middle, ...end];
  return [...start, middle[0], middle[1], middle[2], ...end];
}

/** Plain advice from a check-in (each value 1 to 5; for sensory and social, higher means more load). Works without any AI. */
export function checkinAdvice({ energy = 3, sensory = 3, social = 3, mood = 3 } = {}) {
  const out = [];
  if (energy <= 2 && sensory >= 4) out.push('Low energy plus a heavy sensory load is a risky mix. Cut input first (quiet, dim, softer), then rest. Drop anything that is not essential today.');
  else if (energy <= 2) out.push('Your energy is low. Treat rest as a task and take something off your list if you can. The smallest useful step is enough today.');
  else if (sensory >= 4) out.push('The sensory load is high. A sensory reset (less input, deep pressure, a stim, water) may give you more than pushing on.');
  if (social >= 4) out.push('Your social load is high. Some quiet, alone time, or side-by-side company without talking, could help you refill.');
  if (mood <= 2) out.push('Your mood is low. That is worth noticing, not judging. Be gentle with the plan for today, and tell someone you trust if it has been like this for a while.');
  if (energy >= 4 && sensory <= 2 && mood >= 4) out.push('This looks like a good-capacity moment. If there is something important, this is a good time for it. Set a timer so you remember to eat, drink and rest.');
  if (!out.length) out.push('Nothing stands out. Noticing is the useful part, and over a few days this will show you your own patterns.');
  return out.join('\n\n');
}

export const scripts = SCRIPTS;
