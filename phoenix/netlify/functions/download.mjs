// One short link for "get Phoenix": https://phoenix.neurohubcommunity.org/download
// Phoenix is a web app that installs as an app on any device (computers, phones, tablets), so there is nothing else to download.
// This sends everyone, whatever they open it on, to the one-tap install page, and counts the click. Old installer links
// (/download/windows and so on, and /go) land in the same place.
import { openStore, dayOf, bump, dayKeyFor, isBot } from './_lib/kv.mjs';

export const config = { path: ['/download', '/download/*', '/go'] };

export async function handle(req, ctx = {}, deps = {}) {
  const ua = req.headers.get('user-agent') || '';
  if (req.headers.get('dnt') !== '1' && req.headers.get('sec-gpc') !== '1' && !isBot(ua)) {
    try { await bump(deps.store || (await openStore('phoenix-stats')), dayKeyFor(dayOf(deps.now ? deps.now() : new Date()), 'install_click'), ['e:install_click:landing', 'e:install_click']); } catch { /* never block the visitor */ }
  }
  return new Response(null, { status: 302, headers: { location: '/app/?install=1', 'cache-control': 'no-store' } });
}
export default async (req, ctx) => handle(req, ctx);
