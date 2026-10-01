// Voice chat (talking to Phoenix with the microphone, spoken conversations, hands-free and the "Phoenix" wake word) is for people who
// have signed in to a free Phoenix account. Typing to Phoenix, and having replies read aloud for accessibility, never need one.
import { el, modal, bus, ui } from './util.js';
import { state } from './store.js';
import { trackFeature } from './analytics.js';

/** Is this person signed in, so voice chat is open to them? */
export const voiceAllowed = () => !!state.account?.token;

/** Shows why voice needs an account, with a way to make one. Returns true if voice may go ahead. */
export function requireAccountForVoice() {
  if (voiceAllowed()) return true;
  trackFeature('voice_needs_account');
  const inFloat = ui.doc !== document; // the floating window cannot show the sign-in itself
  modal({
    title: 'Voice chat needs a free account',
    body: el('div', { class: 'stack' },
      el('p', {}, 'Talking with Phoenix out loud, spoken conversations and saying “Phoenix” to wake her are for people with a free Phoenix account. Signing in takes a minute: you get an emailed code, with no password.'),
      el('p', { class: 'muted small' }, 'Typing to Phoenix never needs an account, and neither does having a reply read aloud with its Read aloud button.'),
      inFloat ? el('p', { class: 'small' }, 'Open the main Phoenix window to sign in, then come back and press Talk.') : null),
    actions: [{ label: 'Not now' }, { label: inFloat ? 'Open the sign-in in the main window' : 'Make an account or sign in', class: 'btn-primary', onclick: () => { bus.emit('goto', 'settings:account'); } }],
  });
  return false;
}
