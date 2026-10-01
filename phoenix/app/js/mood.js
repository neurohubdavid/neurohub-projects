// How Phoenix's body responds to words. Reads a few kinds of feeling in what someone types or says, so the mascot can lean in, soften,
// get curious, sparkle or breathe slowly. It runs on the device only: what is typed is never sent anywhere by this.
// It is a gentle guess from common words, never a judgement, and it only changes how the mascot looks.
import { CRISIS_RE } from './safety.js';

const norm = (s) => String(s || '').replace(/[\u2018\u2019]/g, "'"); // curly apostrophes read as plain ones
const WORDS = {
  sad: /\b(sad|down|low|lonely|alone|depress\w*|cry(ing)?|cried|hopeless|empty|numb|grie[fv]\w*|heartbroken|worthless|hate myself|give up|exhausted and sad|miss(ing)? (him|her|them|you))\b/i,
  calm: /\b(overwhelm\w*|overload\w*|panic\w*|anxious|anxiety|worried|worry|scared|afraid|stress\w*|meltdown|shut ?down|burn(t|ed)? ?out|can'?t cope|spiral\w*|too much|frustrat\w*|angry|furious|irritat\w*|annoyed|rage)\b/i,
  happy: /\b(happy|great|good news|excited|proud|yay|brilliant|amazing|wonderful|love (it|this)|did it|managed to|finally|celebrat\w*|won|win|nailed it|fantastic|delighted|relieved|better today)\b|!{2,}|😀|😊|🎉|🥳|❤️/i,
  thanks: /\b(thank(s| you)|cheers|appreciate (it|you|that)|(that|this|it)( really| has| has really)? help(ed|s)|helpful)\b/i,
  greet: /^\s*(hi|hello|hey|hiya|heya|yo|good (morning|afternoon|evening)|morning|evening)\b/i,
  curious: /\?\s*$|^\s*(what|why|how|when|where|who|which|can|could|would|do|does|did|is|are|will|should|explain|tell me)\b/i,
};

/** The feeling in a piece of text: 'sad', 'calm', 'happy', 'greet', 'alert', 'curious' or 'neutral'. */
export function moodFor(text) {
  const t = norm(text).trim();
  if (t.length < 2) return 'neutral';
  if (CRISIS_RE.test(t) || WORDS.sad.test(t)) return 'sad';          // soft and close
  if (WORDS.calm.test(t)) return 'calm';                              // slow breathing: "you are not alone with this"
  if (WORDS.happy.test(t) || WORDS.thanks.test(t)) return 'happy';
  if (WORDS.greet.test(t) && t.length < 40) return 'greet';
  if (/[A-Z]{5,}/.test(t) && !/[a-z]{4,}/.test(t.replace(/[A-Z]{5,}/g, ''))) return 'alert'; // SHOUTING: wide eyes, attentive (not alarmed)
  if (WORDS.curious.test(t)) return 'curious';
  return 'neutral';
}

/** The feeling in Phoenix's own reply, so she can show it as she finishes ("I'm so glad" sparkles, "I'm sorry" softens). */
export function replyMood(text) {
  const t = norm(text);
  if (/\b(i'?m (so )?glad|well done|proud of you|that'?s (great|wonderful|brilliant)|congratulations|good for you|lovely to hear)\b/i.test(t)) return 'happy';
  if (/\b(i'?m (so )?sorry|that sounds (really )?(hard|heavy|painful|exhausting|draining|difficult)|i'?m here with you|you are not alone)\b/i.test(t)) return 'sad';
  return 'neutral';
}

/** Which small action goes with a mood ('wave' when someone says hello). */
export const actFor = (mood) => (mood === 'greet' ? 'wave' : '');
/** Moods that have a look of their own on the mascot ('greet' is an action, not a lasting look). */
export const lookFor = (mood) => (mood === 'greet' ? 'happy' : mood);
