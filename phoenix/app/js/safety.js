// The pure (no DOM) part of the safety layer, so it can be tested in Node. See crisis.js for the "Get help now" screen.
// This runs in the app itself, before and regardless of any AI, so a model can never switch it off.
// Deliberately broad: a false positive shows a supportive panel, a false negative could cost a life.

export const CRISIS_RE = new RegExp(
  [
    'suicid', 'kill (my ?self|me)', 'end (my|it all|my own) ?(life)?', 'want(ed)? to die', "don'?t want to (be here|live|exist|wake up)",
    'better off (dead|without me)', 'no reason to (live|go on)', 'self[- ]?harm', '(hurt|harm|cut|burn|hit) (my ?self|me)\\b',
    'overdos', 'take all (my|the) (pills|tablets)', "can'?t (go on|do this any ?more|keep going)",
    '(being|been|is|are) (abus|hurt|hit|beaten|assault|raped|threaten)', 'abus(es|ing|ed) me', 'unsafe (at|in) (home|my)', 'in danger', 'not safe',
  ].join('|'),
  'i',
);

/** Someone else (or the person) may be in medical danger from a substance. Shown with the emergency number and first-aid steps. */
export const EMERGENCY_RE = /(over ?dos(e|ed|ing)|took too (much|many)|taken too (much|many)|not breathing|stopped breathing|won'?t wake up|can'?t wake (him|her|them|me|my)|unresponsive|passed out and)/i;

/** Plain-text block for the AI system prompt: only vetted details, never invented ones. */
export function crisisText(d, code) {
  const c = d.countries[code];
  const global = d.global.map((g) => `- ${g.name}: ${g.url}`).join('\n');
  if (!c) return { code: null, text: `Country unknown. Do not guess a number. Point them to a worldwide directory and to their local emergency number:\n${global}\n${d.fallbackEmergency}` };
  const lines = c.lines.map((l) => `- ${l.name}: ${l.how} (${l.detail})`).join('\n');
  return { code, text: `Country: ${c.name}. Emergency number: ${c.emergency}.\nSupport lines (use ONLY these exact details, never invent or alter a number):\n${lines}\nMore options:\n${global}` };
}

/** What Phoenix says on its own when the built-in helper is in use, or when an AI call fails during a crisis. */
export function crisisReply(d, code) {
  const c = d.countries[code];
  const lines = c ? c.lines.map((l) => `- **${l.name}**: ${l.how} (${l.detail})`).join('\n') : '';
  const intro = "I'm really glad you told me, and I'm sorry it is this hard right now. ";
  if (c) return `${intro}Please reach someone who can be with you.\n\nSupport you can contact from ${c.name}:\n${lines}\n\nIf you might be in immediate danger, call ${c.emergency}.\n\nIf you can, tell someone you trust as well. You do not have to do this alone.`;
  return `${intro}Please reach someone who can be with you.\n\nThe red **Help** button at the top shows helplines, including text options. ${d.fallbackEmergency}\n\nIf you can, tell someone you trust as well. You do not have to do this alone.`;
}
