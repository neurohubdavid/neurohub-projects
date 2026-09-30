// The pure parts of sharing check-in scores with NeuroHub (see share.js). No DOM and no storage, so they are unit tested.
import { DOMAINS, dayKey } from './sixpf.js';

/** A random ID made on the device. It is the only thing that links someone's shared check-ins together, and it is never their name. */
export function newShareId() {
  const b = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(b);
  if (!b.some(Boolean)) for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** What is sent for one check-in: the date and seven whole numbers from 1 to 5. No notes, no text, no name. */
export const sharePayload = (entry) => ({ at: dayKey(entry.createdAt), s: [entry.overallMood, ...DOMAINS.map((d) => entry.domains.find((x) => x.id === d.id)?.rating ?? 3)] });
