// Guardrails that run in the app, not the model. A real test with a small local model showed it will invent medical
// claims, quote wrong or outdated phone numbers, and make up article titles. So for the topics where that could hurt
// someone, Phoenix answers itself with vetted text (or checks the model's answer) whatever AI is connected.
// Pure functions, no DOM, so they are unit tested.

/** Models under about 3 billion parameters ramble, ignore "keep it short", and get facts wrong. Detected from the name (for example llama3.2:1b). */
export function isSmallModel(name) {
  const n = String(name || '').toLowerCase();
  const m = /[:\-_ ](\d+(?:\.\d+)?)\s?b\b/.exec(n);
  if (m) return Number(m[1]) < 3;
  return /tiny|nano|smol|\bmini\b|[-_]mini\b/.test(n);
}

/** Asking whether to stop, skip, change or take more of a medicine. Never left to a model. */
const MED_WORD = '(medication|medicine|meds|tablets?|pills?|dose|dosage|antidepressants?|antipsychotics?|ssris?|stimulants?|ritalin|methylphenidate|elvanse|vyvanse|lisdexamfetamine|adderall|sertraline|fluoxetine|risperidone|aripiprazole|quetiapine|olanzapine|clozapine|lithium|melatonin|propranolol|guanfacine|atomoxetine)';
const MED_ACT = '(stop|quit|come off|coming off|go off|going off|skip|miss|missing|double|increase|reduce|lower|cut down|cut back|change|switch|swap|wean|taper|mix|take more|take less|take extra)';
export const MED_RE = new RegExp(`(\\b${MED_ACT}\\b.{0,40}\\b${MED_WORD}\\b|\\b${MED_WORD}\\b.{0,40}\\b${MED_ACT}\\b|how (much|many).{0,25}\\b(should i|can i|do i).{0,15}\\btake\\b|\\b(should i|can i) (stop|skip|take|double))`, 'i');
export const medicationIntent = (t) => MED_RE.test(String(t || ''));

export function medicationReply() {
  return `I can't tell you whether to stop, skip or change a medicine, or how much to take. That has to come from the person who prescribes it, and I'd be guessing.

**Please don't stop suddenly on your own.** Stopping some medicines abruptly can be harmful, and the side effects are usually something a prescriber can work with.

Side effects that are annoying are worth taking seriously. You can tell your prescriber, in plain words:
- what the side effect is, when it happens and how much it affects your day
- that Autistic and ADHD people often react differently to medicines, and that you would like to talk about **starting low and going slow** if a change is needed
- if you cannot eat before a dose, or find it hard to remember doses, so they can plan around that

If something feels frightening or dangerous right now (chest pain, trouble breathing, feeling very unwell, or thoughts of harming yourself), use the Help button or call your local emergency number.

If you would like, I can help you write down what to say to your prescriber.`;
}

/** "What has NeuroHub written about X?": answer with the real articles, never a model's memory of them. */
export const SITE_Q_RE = /(neuro ?hub|gray-?hammond|david)\b.{0,50}\b(written|wrote|say|says|said|articles?|posts?|blogs?|published|covered|resources?)|\b(articles?|posts?|blogs?|resources?|anything|something)\b.{0,40}\b(neuro ?hub|on your (site|website)|neurohubcommunity)|\b(neuro ?hub|your website|the website).{0,20}(about|on)\b|(helen ?edgar|autistic ?realms|more ?realms)\b.{0,50}\b(written|wrote|say|says|said|articles?|posts?|blogs?|published|covered|resources?|guides?)|\b(articles?|posts?|blogs?|resources?|guides?|anything|something)\b.{0,40}\b(helen ?edgar|autistic ?realms|more ?realms)/i;
export const siteQuestionIntent = (t) => SITE_Q_RE.test(String(t || ''));

export function siteListReply(hits, name = '') {
  if (!hits.length) return `${name ? name + ', ' : ''}I couldn't find anything on neurohubcommunity.org, Autistic Realms or More Realms that matches that. Try different words, or ask me directly and I'll answer from what I know.`;
  const web = hits.filter((h) => h.kind !== 'presentation' && h.kind !== 'transcript'), decks = [...new Set(hits.filter((h) => h.kind === 'presentation').map((h) => h.deck))];
  const parts = [];
  if (web.length) parts.push(`Here is what NeuroHub Community and Helen Edgar’s Autistic Realms and More Realms have that fits:\n${web.map((h) => `- [${h.title}](${h.url})${h.src && !/^NeuroHub/.test(h.src) ? ` (${h.src})` : ''}`).join('\n')}`);
  if (decks.length) parts.push(`NeuroHub's training presentations also cover it:\n${decks.map((d) => `- ${d}`).join('\n')}`);
  return `${parts.join('\n\n')}\n\nI only list what actually exists. Want me to explain the idea in my own words too?`;
}

/**
 * Checks a model's reply during a crisis. Small models quote outdated or foreign hotline numbers and sometimes refuse
 * coldly. `allowed` is the vetted crisis block for the person's country. Returns { ok, reason }.
 */
export function validateCrisisReply(reply, allowed) {
  const digitsOnly = (s) => String(s).replace(/\D/g, '');
  const allowedDigits = digitsOnly(allowed);
  const numbers = String(reply).match(/\+?\d[\d\s().-]{1,}\d/g) || [];
  for (const n of numbers) {
    const d = digitsOnly(n);
    if (d.length >= 3 && !allowedDigits.includes(d)) return { ok: false, reason: `number not in the vetted list: ${n.trim()}` };
  }
  const links = String(reply).match(/https?:\/\/[^\s)]+|\b[a-z0-9-]+\.(?:org|com|net|co\.uk|ie|au|nz)\b[^\s)]*/gi) || [];
  for (const l of links) if (!String(allowed).toLowerCase().includes(l.replace(/^https?:\/\//i, '').replace(/[.,;:!?]+$/, '').toLowerCase())) return { ok: false, reason: `link not in the vetted list: ${l}` };
  if (/\bI (cannot|can't|can not|won't|am unable to) (provide|help|assist|support|discuss)/i.test(reply)) return { ok: false, reason: 'cold refusal' };
  if (/\b(suicide prevention lifeline|1-?800-?273)/i.test(reply)) return { ok: false, reason: 'outdated service' };
  if (String(reply).trim().length < 20) return { ok: false, reason: 'too short' };
  return { ok: true };
}

export const CRISIS_FOLLOWUP = "I'm here with you. The numbers above are the ones to use right now. If you want to, tell me what is happening, in as few words as you like. There's no rush, and you don't have to explain it well.";
