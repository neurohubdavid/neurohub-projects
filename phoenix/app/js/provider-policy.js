// Phoenix's AI comes from one place only: NeuroHub Community's own Claude account, reached through Phoenix's server ("shared").
// The only other choice is no AI at all (the built-in helper, "offline"). Nobody has to, or can, connect another AI or enter a key.
// Pure and tested, so an older saved setting (a local model, or someone's own key) can never make the app talk to anything else.
export const KINDS = ['shared', 'offline'];

/** Anything other than "shared" or "offline" becomes "shared", and any key that was saved for another service is erased. Returns true if something changed. */
export function normaliseProvider(state) {
  const p = (state.provider ||= { kind: 'shared' });
  let changed = false;
  if (!KINDS.includes(p.kind)) { p.kind = 'shared'; changed = true; }
  for (const k of ['ollama', 'openai', 'anthropic']) if (p[k]) { delete p[k]; changed = true; }
  return changed;
}
