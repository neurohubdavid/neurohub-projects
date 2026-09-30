// Counts a download, then sends the person to the installer on GitHub. Only real Phoenix installer names are accepted, so this
// cannot be used to redirect anywhere else. Nothing about the person is stored.
import { openStore, dayOf, bump, platformOf, dayKeyFor, isBot } from './_lib/kv.mjs';

export const config = { path: '/go' };

const FILE_RE = /^Phoenix-(Setup|Portable|Linux)-\d+\.\d+\.\d+-(x64|arm64)\.(exe|tar\.gz)$/;
const VER_RE = /^\d+\.\d+\.\d+$/;

export async function handle(req, ctx = {}, deps = {}) {
  const u = new URL(req.url);
  const f = u.searchParams.get('f') || '', v = u.searchParams.get('v') || '';
  if (!FILE_RE.test(f) || !VER_RE.test(v)) return new Response('Not found', { status: 404 });
  const base = (deps.base || process.env.PHOENIX_DOWNLOAD_BASE || `https://github.com/neurohubdavid/neurohub-projects/releases/download/phoenix-v${v}`).replace(/\/+$/, '');
  if (req.headers.get('dnt') !== '1' && req.headers.get('sec-gpc') !== '1' && !isBot(req.headers.get('user-agent') || '')) {
    try {
      const names = [`e:download:${f}`, 'e:download', `plat:download:${platformOf(req.headers.get('user-agent') || '')}`];
      const c = ctx.geo?.country?.code; if (/^[A-Z]{2}$/.test(c || '')) names.push(`country:download:${c}`);
      await bump(deps.store || (await openStore('phoenix-stats')), dayKeyFor(dayOf(deps.now ? deps.now() : new Date()), 'download'), names);
    } catch { /* never block a download because counting failed */ }
  }
  return new Response(null, { status: 302, headers: { location: `${base}/${f}`, 'cache-control': 'no-store' } });
}
export default async (req, ctx) => handle(req, ctx);
