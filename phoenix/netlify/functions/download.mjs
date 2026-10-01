// One short link that starts the right download at once: https://phoenix.neurohubcommunity.org/download
//   /download            picks for the visitor's device: Windows gets the installer, Linux the Linux build, and phones, tablets and Macs
//                        (which have no installer) are taken to the installable web app
//   /download/windows    Windows installer (Intel and AMD, also runs on Windows on ARM)
//   /download/windows-arm  Windows installer built for ARM
//   /download/portable   Windows version that runs without installing
//   /download/linux      Linux build (tar.gz)
//   /download/app        the installable web app (any device)
// Counting and the redirect to the installer are done by /go (go.mjs), so the numbers all land in one place.
import { handle as go } from './go.mjs';
import { openStore, dayOf, bump, dayKeyFor, isBot } from './_lib/kv.mjs';
import { version as RELEASE } from './_lib/release.mjs';

export const config = { path: ['/download', '/download/*'] };

export const FILES = (v) => ({
  windows: `Phoenix-Setup-${v}-x64.exe`,
  'windows-arm': `Phoenix-Setup-${v}-arm64.exe`,
  portable: `Phoenix-Portable-${v}-x64.exe`,
  'portable-arm': `Phoenix-Portable-${v}-arm64.exe`,
  linux: `Phoenix-Linux-${v}-x64.tar.gz`,
});

/** Which download suits this browser? Returns a key of FILES, or 'app' for the web app. */
export function pick(ua = '') {
  if (/android|iphone|ipad|ipod|cros/i.test(ua)) return 'app';
  if (/windows/i.test(ua)) return 'windows';
  if (/linux|x11/i.test(ua)) return 'linux';
  return 'app'; // Mac and anything unknown: the web app installs in a click
}

export async function handle(req, ctx = {}, deps = {}) {
  const version = deps.version || RELEASE;
  const slug = new URL(req.url).pathname.replace(/\/+$/, '').split('/').slice(2)[0] || '';
  const ua = req.headers.get('user-agent') || '';
  const key = slug || pick(ua);
  const files = FILES(version);
  if (key === 'app' || !files[key]) {
    if (key !== 'app' && slug) return new Response('Not found', { status: 404 });
    if (req.headers.get('dnt') !== '1' && req.headers.get('sec-gpc') !== '1' && !isBot(ua)) {
      try { await bump(deps.store || (await openStore('phoenix-stats')), dayKeyFor(dayOf(deps.now ? deps.now() : new Date()), 'install_click'), ['e:install_click:landing', 'e:install_click']); } catch { /* never block the visitor */ }
    }
    return new Response(null, { status: 302, headers: { location: '/app/?install=1', 'cache-control': 'no-store' } });
  }
  return go(new Request(`https://phoenix.neurohubcommunity.org/go?f=${encodeURIComponent(files[key])}&v=${version}`, { headers: req.headers }), ctx, deps);
}
export default async (req, ctx) => handle(req, ctx);
