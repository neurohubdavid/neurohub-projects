// Sends the sign-in code by email through Brevo. Plain, short and accessible: the code is the first thing, in large text.
// Nothing else is ever emailed by Phoenix.
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function signInEmail(code, link, minutes) {
  const subject = `Your Phoenix sign-in code: ${code}`;
  const text = `Your Phoenix sign-in code is ${code}\n\nType it into Phoenix, or open this link on the device you want to sign in on:\n${link}\n\nIt works once and expires in ${minutes} minutes. If you did not ask for this, you can ignore this email and nothing will happen.\n\nPhoenix by NeuroHub Community\nhttps://phoenix.neurohubcommunity.org`;
  const html = `<!doctype html><html lang="en-GB"><body style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5;color:#1b1230;max-width:34rem;margin:0 auto;padding:1rem">
<p>Your Phoenix sign-in code is</p>
<p style="font-size:2rem;font-weight:700;letter-spacing:.15em;margin:.25rem 0 1rem">${esc(code)}</p>
<p>Type it into Phoenix, or <a href="${esc(link)}">open Phoenix to sign in</a> on the device you want to sign in on.</p>
<p>It works once and expires in ${minutes} minutes. If you did not ask for this, you can ignore this email and nothing will happen.</p>
<p style="color:#5b5272;font-size:.9rem">Phoenix by NeuroHub Community, <a href="https://phoenix.neurohubcommunity.org">phoenix.neurohubcommunity.org</a></p></body></html>`;
  return { subject, text, html };
}

/** Sends one email through Brevo. Returns true if Brevo accepted it. */
export async function sendViaBrevo({ apiKey, from, to, subject, text, html }, fetchFn = fetch) {
  const res = await fetchFn('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Phoenix by NeuroHub Community', email: from }, to: [{ email: to }], subject, htmlContent: html, textContent: text, tags: ['phoenix-signin'] }),
  });
  return res.ok;
}
