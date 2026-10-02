// Pronouns in the app: the pure rules are in pronouns-core.js; this file ties them to the person's saved choice.
import { state } from './store.js';
import { setPronounSource } from './pronouns-core.js';
export * from './pronouns-core.js';
setPronounSource(() => state?.prefs?.phoenixPronouns);
