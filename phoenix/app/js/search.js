// Tiny BM25-style search over the blog index. Used at build time (chapter reading lists) and by Phoenix at request time.
const STOP = new Set(('a about above after again all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our out over own same she should so some such than that the their them then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself about really much many get got make made like one two also').split(/\s+/));

// Light stemming: strip common endings, then compare on the first 8 letters so overdiagnosed ~ overdiagnosis.
const stem = (w) => w.replace(/(ations?|ments?|ness|ings?|ed|ly|es|s)$/i, (m, x, off) => (off >= 3 ? '' : m)).slice(0, 8);
export const tokenize = (s) => (String(s || '').toLowerCase().match(/[a-z][a-z'’-]{2,}/g) || []).map((w) => w.replace(/['’]s$/, '')).filter((w) => !STOP.has(w)).map(stem);

export function buildIndex(posts) {
  const docs = [], df = new Map();
  let totalLen = 0;
  for (const p of posts) {
    const tf = new Map();
    const add = (tokens, weight) => { for (const t of tokens) tf.set(t, (tf.get(t) || 0) + weight); };
    const tt = tokenize(p.title), et = tokenize(p.excerpt), bt = tokenize(p.text);
    add(tt, 4); add(et, 2); add(bt, 1);
    let len = 0; tf.forEach((v) => (len += v));
    tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1));
    docs.push({ p, tf, len, titleSet: new Set(tt) });
    totalLen += len;
  }
  return { docs, df, N: docs.length, avg: totalLen / Math.max(1, docs.length) };
}

export function search(index, query, k = 3, minScore = 6) {
  if (!index?.N) return [];
  const q = [...new Set(tokenize(query))];
  if (!q.length) return [];
  const k1 = 1.4, b = 0.7;
  // Words that appear in most posts ("autistic", "people") say little. Require the specific words to match.
  const informative = q.filter((t) => (index.df.get(t) || 0) / index.N <= 0.3);
  if (!informative.length) return [];
  const need = Math.min(2, informative.length);
  const infSet = new Set(informative);
  const scored = index.docs.map((d) => {
    let score = 0, hits = 0, infHits = 0;
    for (const t of q) {
      const f = d.tf.get(t); if (!f) continue;
      hits++; if (infSet.has(t)) infHits++;
      const idf = Math.log(1 + (index.N - (index.df.get(t) || 0) + 0.5) / ((index.df.get(t) || 0) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / index.avg)));
      if (d.titleSet.has(t)) score += idf * 1.5;
    }
    // reward matching several distinct query terms, not one term many times
    score *= 0.5 + (hits / q.length) * 0.5 + Math.min(hits, 4) * 0.1;
    return { p: d.p, score, hits, infHits };
  }).filter((x) => x.infHits >= need && x.score >= minScore);
  return scored.sort((a, b2) => b2.score - a.score).slice(0, k);
}

/** The most relevant paragraphs of a post for a query, kept in original order, within a character budget. */
export function passages(text, query, maxChars = 1500) {
  const q = new Set(tokenize(query));
  const paras = String(text || '').split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 40);
  if (!paras.length) return '';
  const ranked = paras.map((s, i) => ({ s, i, sc: tokenize(s).reduce((n, t) => n + (q.has(t) ? 1 : 0), 0) })).sort((a, b) => b.sc - a.sc || a.i - b.i);
  const picked = []; let used = 0;
  for (const r of ranked) { if (used + r.s.length > maxChars && picked.length) break; picked.push(r); used += r.s.length; if (used >= maxChars) break; }
  return picked.sort((a, b) => a.i - b.i).map((r) => (r.s.length > maxChars ? r.s.slice(0, maxChars) + '…' : r.s)).join('\n');
}
