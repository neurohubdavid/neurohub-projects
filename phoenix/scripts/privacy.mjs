// Keeps people's names and personal details out of what Phoenix knows and can repeat to users.
// Rules (decided with NeuroHub's founder):
//   - Ideas, research and the authorship of published work stay: researcher citations ("Murray, Lesser & Lawson, 2005"),
//     "a concept from Tanya Adkin", book titles and NeuroHub's own name.
//   - Private individuals never appear: speakers, guests, colleagues, family, community members, and where people live or work.
//   - Personal details never appear, including the founder's own health history and life story. First-person accounts are dropped.
// Everything here works sentence by sentence: a sentence that breaks a rule is dropped whole, which is safer than swapping a
// name for "someone" (the rest of the sentence usually still identifies the person).

// Names of people who appear in the transcripts and presentations and are not published authorities on the ideas.
export const PRIVATE_NAMES = [
  'David', 'Betsy', 'Reverend Betsy', 'Adele', 'Adele Murray', 'Helen', 'Helen Edgar', 'Helen Buckley', 'Helen Pedgar', 'Edgar', 'Debbie', 'Charlie', 'Charlie Hart', 'Awesome Charlie', 'Ausome Charlie', 'Jay', 'JT',
  'Azzy', 'Azi', 'Iggy', 'Neil', 'Colin', 'Carlin', 'Annalise', 'Bob', 'Oliver', 'Cooper', 'Cooper Anna', 'Anna', 'Seal', 'Cynthia', 'Cynthia Fortledge', 'Singh',
  'Kassian', 'Kassian Assasumassu', 'Amy Skinner', 'Kay Aldred', 'Ryan Bowen', 'Tanya', 'Tanya Adkin', 'Gray-Hammond', 'David Gray-Hammond', 'David Graham', 'Trevor Mann', 'Daviesport', 'Nick',
];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const NAME_RE = new RegExp(`\\b(${[...PRIVATE_NAMES].sort((a, b) => b.length - a.length).map(esc).join('|')})\\b`);
// Places and institutions tied to specific people's lives.
export const PLACE_RE = /\b(Brighton|Bognor Regis|Manchester|Sheffield Hallam|York St\.? John|Switzerland|Lake Geneva|Daviesport|London Trans|Lady Chapel|Trevor Mann)\b/i;
export const FIRST_PERSON_RE = /\b(?:I|I['’](?:m|ve|d|ll)|me|my|mine|myself)\b/i;
// Sentences about one particular person ("she was", "his son") in conversations that are full of people's own lives.
export const THIRD_PERSON_RE = /\b(?:she|he|her|hers|him|his|himself|herself|she['’]s|he['’]s|she['’]d|he['’]d)\b/i;
export const RELATIVE_RE = /\b(mum|mother|mam|dad|father|son|daughter|sister|brother|wife|husband|partner|nana|nan|grandma|grandad|grandson|granddaughter|godson|priest|bishop|archdeacon|vicar|reverend|congregation)\b/i;
// A first-person sentence that touches health, treatment, substances or harm is a personal disclosure, wherever it comes from.
export const HEALTH_RE = /\b(diagnos\w*|schizophren\w*|psychosis|psychotic|hospital\w*|wards?|sectioned|medicat\w*|overdos\w*|addict\w*|recover\w*|sober|sobriety|relaps\w*|therap\w*|counsell\w*|suicid\w*|self[- ]harm\w*|trauma\w*|abus\w*|assault\w*|burn(?:t|ed)? ?out|breakdown|depress\w*|anxiety|panic|agoraphobi\w*|voices|paranoi\w*|drugs?|cannabis|alcohol\w*|drink\w*|smok\w*|pills?|seizures?|surgery|cancer|pregnan\w*|miscarr\w*|dying|died|death|bereave\w*|funeral)\b/i;
// A story about one particular unnamed person ("this lady had...").
export const ANECDOTE_RE = /\b(this|that|one|a|the) (lady|man|woman|guy|girl|boy|patient|client|resident|gentleman|chap|kid|student|colleague|friend|neighbour|manager|boss)\b/i;
export const CREDENTIALS_RE = /\b(MCMA|AP APM|APM|MSc|BSc|PhD)\b|,\s*MA\b/;
export const CONTACT_RE = /@[a-z0-9-]+\.[a-z.]+|\b0\d{3,4} ?\d{5,6}\b|\+\d{8,}|https?:\/\/|www\./i;

export const sentences = (text) => String(text).match(/[^.!?\n]+[.!?]+["')\]”’]*|[^.!?\n]+$/g)?.map((s) => s.trim()).filter(Boolean) || [];

/** Why a sentence must go, or '' if it can stay. mode: 'transcript' (strict), 'impersonal' (transcripts of personal conversations), 'slide'. */
export function whyDrop(s, mode = 'slide') {
  if (NAME_RE.test(s)) return 'name';
  if (PLACE_RE.test(s)) return 'place';
  if (CONTACT_RE.test(s)) return 'contact';
  if (CREDENTIALS_RE.test(s)) return 'credentials';
  if (FIRST_PERSON_RE.test(s) && HEALTH_RE.test(s)) return 'personal health';
  if (/\bI(?:['’]m| am| was| have been)\b[^.?!]*\b(autistic|adhd|audhd|neurodivergent|disabled|queer|gay|lesbian|bisexual|trans|non-?binary|dyslexic|dyspraxic)\b/i.test(s) || /\bas an? (autistic|adhd|queer|gay|trans|disabled|neurodivergent)\b[^.?!]*\bmyself\b/i.test(s)) return 'self-identification';
  if (FIRST_PERSON_RE.test(s) && (mode === 'impersonal' || mode === 'slide')) return 'first person';
  if (mode === 'impersonal' && ANECDOTE_RE.test(s)) return 'anecdote';
  if (mode !== 'slide' && RELATIVE_RE.test(s) && FIRST_PERSON_RE.test(s + ' ')) return 'relative';
  if (mode === 'impersonal' && (RELATIVE_RE.test(s) || THIRD_PERSON_RE.test(s) || /\b(we|our|us)\b/i.test(s))) return 'personal';
  if (mode === 'impersonal' && s.length < 55) return 'too short to mean anything alone'; // chit-chat like "Brilliant." and "Who cares?"
  return '';
}
/** Sentences that survive, with a count of what was dropped by reason. */
export function scrub(text, mode = 'slide') {
  const kept = [], dropped = {};
  for (const s of sentences(text)) { const why = whyDrop(s, mode); if (why) dropped[why] = (dropped[why] || 0) + 1; else kept.push(s); }
  return { text: kept.join(' '), dropped };
}
/** For slides: line by line, so bullet structure survives. Returns '' for a line that is only personal. */
export function scrubLine(line, mode = 'slide') { return scrub(line, mode).text; }
