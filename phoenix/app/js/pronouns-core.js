// Pronouns, for Phoenix and for the person. Each person chooses what Phoenix is called (she/her, he/him or they/them) and what Phoenix should
// call them. Copy that refers to Phoenix is written with small tokens and filled in here, so one choice changes every sentence:
//   ph('Say “Phoenix” and {they} {start|starts} a conversation: {they} listen…')
// {they} {them} {their} {theirs} {themself} (capitalised as {They}… for a sentence start), and {plural|singular-verb} for agreement:
// they/them takes the first form ("they start"), she/her and he/him take the second ("she starts").

export const PHOENIX_SETS = {
  she: { they: 'she', them: 'her', their: 'her', theirs: 'hers', themself: 'herself', label: 'she/her', plural: false },
  he: { they: 'he', them: 'him', their: 'his', theirs: 'his', themself: 'himself', label: 'he/him', plural: false },
  they: { they: 'they', them: 'them', their: 'their', theirs: 'theirs', themself: 'themself', label: 'they/them', plural: true },
};
export const DEFAULT_PHOENIX = 'he';
let source = () => DEFAULT_PHOENIX; // the person's choice, set once by pronouns.js (kept apart so this file needs no browser)
export const setPronounSource = (fn) => { source = fn; };
export const phoenixKey = () => (PHOENIX_SETS[source()] ? source() : DEFAULT_PHOENIX);
export const phoenixSet = () => PHOENIX_SETS[phoenixKey()];

const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Fills the pronoun tokens in a sentence about Phoenix. `key` is for tests and previews; normally the person's choice is used. */
export function ph(text, key) {
  const p = key ? PHOENIX_SETS[key] || PHOENIX_SETS[DEFAULT_PHOENIX] : phoenixSet();
  return String(text).replace(/\{(they|them|their|theirs|themself|They|Them|Their|Theirs|Themself)\}/g, (_, w) => {
    const v = p[w.toLowerCase()]; return w[0] === w[0].toUpperCase() ? cap(v) : v;
  }).replace(/\{([^{}|]+)\|([^{}|]+)\}/g, (_, plural, singular) => (p.plural ? plural : singular));
}

/** What a person can choose for themselves. `value` is what is stored; `ai` is how the AI is told to refer to them. */
export const PERSON_PRONOUNS = [
  ['', 'Not saying', ''],
  ['she/her', 'she/her', 'she/her'],
  ['he/him', 'he/him', 'he/him'],
  ['they/them', 'they/them', 'they/them'],
  ['she/they', 'she/they', 'she/her and they/them'],
  ['he/they', 'he/they', 'he/him and they/them'],
  ['any', 'Any pronouns', 'any pronouns, so use their name or they/them if unsure'],
  ['name', 'Just use my name', 'no pronouns: use only their name, never he, she or they'],
  ['other', 'Something else', ''],
];
export const cleanPronouns = (s) => String(s || '').replace(/[\r\n<>`"{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);

/** The sentence for the AI's notes about the person (data, not instructions). Empty when they have not said. */
export function personPronounNote(profile = {}) {
  const v = profile.pronouns || '';
  if (!v) return '';
  const known = PERSON_PRONOUNS.find((o) => o[0] === v && o[2]);
  if (known) return `Their pronouns are ${known[2]}. Respect them if you ever refer to them in the third person.`;
  const custom = cleanPronouns(profile.pronounsCustom);
  return custom ? `Their pronouns are: ${custom}. Respect them if you ever refer to them in the third person.` : '';
}

/** The sentence for the AI about itself, so it answers consistently if someone asks or refers to Phoenix. */
export function phoenixPronounNote(key) {
  const p = PHOENIX_SETS[key] || phoenixSet();
  return `PHOENIX'S PRONOUNS: the person has chosen ${p.label} for you. If they refer to you with those, that is right; if you ever refer to yourself in the third person, use them. If they ask, say plainly that you are an AI and these are the pronouns they picked for you, and that they can change them in Settings.`;
}
