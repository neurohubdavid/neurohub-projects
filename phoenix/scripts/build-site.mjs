// Builds the download site into ./site :
//   site/index.html         landing page with download buttons and SHA-256 checksums
//   site/downloads/*.exe    the installers (copied from ./dist)
//   site/app/               the web version (installable as an app on Mac, Linux, Android, iOS, Chromebook)
//   site/_headers           caching and download headers for Netlify
// Run `npm run dist` first, then `node scripts/build-site.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pages, ORIGIN } from './site-pages.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(site, 'downloads'), { recursive: true });

// Which installers to publish (the combined x64+arm64 files are twice the size, so they are left out).
const FILES = [
  { file: `Phoenix-Setup-${version}-x64.exe`, label: 'Windows installer', note: 'Most Windows PCs (Intel and AMD). Recommended.', primary: true },
  { file: `Phoenix-Portable-${version}-x64.exe`, label: 'Windows portable', note: 'No install: run it from a folder or a USB stick. Intel and AMD.' },
  { file: `Phoenix-Setup-${version}-arm64.exe`, label: 'Windows installer (ARM)', note: 'Windows on ARM (for example Surface Pro X, Snapdragon laptops).' },
  { file: `Phoenix-Linux-${version}-x64.tar.gz`, label: 'Linux (experimental)', note: 'Unpack it and run the "phoenix" file inside. We have not been able to test this build on Linux, so please tell us if it does not work. If it refuses to start, try running it with --no-sandbox.' },
];
const DOWNLOAD_BASE = process.env.DOWNLOAD_BASE ?? `https://github.com/neurohubdavid/neurohub-projects/releases/download/phoenix-v${version}`;
const rows = [];
for (const f of FILES) {
  const src = path.join(root, 'dist', f.file);
  if (!fs.existsSync(src)) { console.warn('missing', f.file); continue; }
  // The installers are served from the GitHub release (free bandwidth), not from Netlify. Set DOWNLOAD_BASE="" to serve them locally.
  if (!DOWNLOAD_BASE) fs.copyFileSync(src, path.join(site, 'downloads', f.file));
  const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
  rows.push({ ...f, hash, mb: (fs.statSync(src).size / 1048576).toFixed(0) });
}

// The web version.
fs.cpSync(path.join(root, 'app'), path.join(site, 'app'), { recursive: true });
fs.rmSync(path.join(site, 'app', 'js', 'package.json'), { force: true });
// Stamp the service worker with a hash of the app's files, so every change makes installed copies fetch the new version.
{
  const h = crypto.createHash('sha1');
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name !== 'sw.js') h.update(e.name).update(fs.readFileSync(p)); } };
  walk(path.join(site, 'app'));
  const swPath = path.join(site, 'app', 'sw.js');
  fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace(/const VERSION = '[^']*';/, `const VERSION = 'phoenix-${version}-${h.digest('hex').slice(0, 10)}';`));
}
// shared brand assets for the landing page
fs.mkdirSync(path.join(site, 'assets'), { recursive: true });
fs.cpSync(path.join(root, 'app', 'fonts'), path.join(site, 'assets', 'fonts'), { recursive: true });
fs.copyFileSync(path.join(root, 'app', 'icons', 'icon-512.png'), path.join(site, 'assets', 'icon-512.png'));
fs.copyFileSync(path.join(root, 'app', 'icons', 'icon-192.png'), path.join(site, 'assets', 'icon-192.png'));
fs.copyFileSync(path.join(root, 'app', 'icons', 'icon-192.png'), path.join(site, 'favicon.png'));

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const downloads = rows.map((r) => `
      <div class="card dl${r.primary ? ' primary' : ''}">
        <div>
          <h3>${esc(r.label)}</h3>
          <p>${esc(r.note)}</p>
          <details><summary>SHA-256 checksum</summary><code>${r.hash}</code></details>
        </div>
        <a class="btn ${r.primary ? 'btn-primary' : ''}" href="${DOWNLOAD_BASE ? `/go?f=${encodeURIComponent(r.file)}&v=${version}` : '/downloads/' + esc(r.file)}" rel="noopener">Download · ${r.mb} MB</a>
      </div>`).join('\n');

// ---------------------------------------------------------------- pages, sitemap, robots, analytics script, private stats page
const pageMap = pages({ version, downloads, hasDownloads: rows.length > 0, esc });
const today = new Date().toISOString().slice(0, 10);
for (const [route, html] of Object.entries(pageMap)) {
  const dir = path.join(site, route === '/' ? '' : route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
fs.writeFileSync(path.join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(pageMap).filter((r) => r !== '/thanks/').map((r) =>`  <url><loc>${ORIGIN}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(site, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /go\nDisallow: /download\nDisallow: /embed/\nDisallow: /admin/\nDisallow: /stats/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const ogSrc = path.join(root, 'brand', 'og-image.png');
if (fs.existsSync(ogSrc)) fs.copyFileSync(ogSrc, path.join(site, 'assets', 'og-image.png')); else console.warn('missing brand/og-image.png (run node scripts/make-og.mjs)');
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'hit.js'), path.join(site, 'assets', 'hit.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'install.js'), path.join(site, 'assets', 'install.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'donate.js'), path.join(site, 'assets', 'donate.js'));
// The floating widget other websites add with one script tag, and the version the /download link serves.
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'embed.js'), path.join(site, 'embed.js'));
fs.writeFileSync(path.join(root, 'netlify', 'functions', '_lib', 'release.mjs'), `export const version = '${version}';\n`);
// The private backend: a sign-in page and its script. The server (netlify/functions/admin.mjs) refuses everything that is not a
// signed-in person with the Admin role; the old /stats/ address is sent here.
fs.mkdirSync(path.join(site, 'admin'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin.html'), path.join(site, 'admin', 'index.html'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin.js'), path.join(site, 'admin', 'admin.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin-pdf.js'), path.join(site, 'admin', 'admin-pdf.js')); // the PDF report is drawn in the admin's own browser
fs.copyFileSync(path.join(root, 'app', 'vendor', 'pdf-lib.esm.min.js'), path.join(site, 'admin', 'pdf-lib.esm.min.js'));
// /embed/ is the app itself (so every relative file it loads still works), served on its own address so it alone may be shown inside other websites.
fs.writeFileSync(path.join(site, '_redirects'), '/stats /admin/ 301\n/stats/* /admin/ 301\n/embed/ /app/index.html 200\n/embed/* /app/:splat 200\n');

fs.writeFileSync(path.join(site, '_headers'), `/downloads/*
  Content-Type: application/octet-stream
  Content-Disposition: attachment
  Cache-Control: public, max-age=31536000, immutable
/app/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors 'self'
/embed/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors *
/embed.js
  Content-Type: text/javascript; charset=utf-8
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *
/assets/icon-192.png
  Access-Control-Allow-Origin: *
  Cross-Origin-Resource-Policy: cross-origin
/app/sw.js
  Cache-Control: no-cache
  Service-Worker-Allowed: /app/
/app/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache
/app/icons/*
  Cache-Control: public, max-age=604800
/app/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/assets/*
  Cache-Control: public, max-age=86400
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
  Referrer-Policy: no-referrer
  X-Frame-Options: DENY
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
/sitemap.xml
  Content-Type: application/xml; charset=utf-8
  Cache-Control: public, max-age=3600
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log('site built:', rows.length, 'downloads,', Object.keys(pageMap).length, 'pages, sitemap.xml, robots.txt');