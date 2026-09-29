// HTML to clean plain text, shared by the build script (Node) and the in-app refresh (browser). No dependencies.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', pound: '£', eacute: 'é', egrave: 'è', ccedil: 'ç', uuml: 'ü', ouml: 'ö', auml: 'ä' };
export const decode = (s) => String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
export function htmlToText(html) {
  return decode(String(html || '')
    .replace(/<(script|style|figure|iframe|noscript|nav|footer|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\u00a0]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
