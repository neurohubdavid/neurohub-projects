// Builds the website into ./site :
//   site/index.html, /privacy/, /accessibility/, /add-to-your-site/, /thanks/   the pages (see site-pages.mjs)
//   site/app/               Phoenix itself, the web app that installs as an app on any device (PWA)
//   site/embed.js           the floating widget other websites can add
//   site/_headers           caching and framing rules for Netlify
// Run `node scripts/build-site.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pages, ORIGIN } from './site-pages.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(site, { recursive: true });


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

// ---------------------------------------------------------------- pages, sitemap, robots, analytics script, private stats page
const pageMap = pages({ version, esc });
const today = new Date().toISOString().slice(0, 10);
for (const [route, html] of Object.entries(pageMap)) {
  const dir = path.join(site, route === '/' ? '' : route);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
fs.writeFileSync(path.join(site, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(pageMap).filter((r) => r !== '/thanks/').map((r) =>`  <url><loc>${ORIGIN}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(site, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /download\nDisallow: /embed/\nDisallow: /desktop/\nDisallow: /backend/\nDisallow: /admin/\nDisallow: /stats/\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);
const ogSrc = path.join(root, 'brand', 'og-image.png');
if (fs.existsSync(ogSrc)) fs.copyFileSync(ogSrc, path.join(site, 'assets', 'og-image.png')); else console.warn('missing brand/og-image.png (run node scripts/make-og.mjs)');
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'hit.js'), path.join(site, 'assets', 'hit.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'install.js'), path.join(site, 'assets', 'install.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'donate.js'), path.join(site, 'assets', 'donate.js'));
// The floating widget other websites add with one script tag.
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'embed.js'), path.join(site, 'embed.js'));
// The page the Phoenix desktop program shows in its see-through window (the same character as the widget, over everything else).
fs.mkdirSync(path.join(site, 'desktop'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'desktop.html'), path.join(site, 'desktop', 'index.html'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'desktop.js'), path.join(site, 'desktop', 'desktop.js'));
// /backend/ : the easy-to-find page for installing the backend as an app on Windows or Android (private, not listed in search)
fs.mkdirSync(path.join(site, 'backend'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'backend.html'), path.join(site, 'backend', 'index.html'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'backend.js'), path.join(site, 'backend', 'backend.js'));
// The private backend: a sign-in page and its script. The server (netlify/functions/admin.mjs) refuses everything that is not a
// signed-in person with the Admin role; the old /stats/ address is sent here.
fs.mkdirSync(path.join(site, 'admin'), { recursive: true });
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin.html'), path.join(site, 'admin', 'index.html'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin.js'), path.join(site, 'admin', 'admin.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin-pwa.js'), path.join(site, 'admin', 'admin-pwa.js'));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin-sw.js'), path.join(site, 'admin', 'sw.js'));
fs.cpSync(path.join(root, 'scripts', 'site-assets', 'admin-icons'), path.join(site, 'admin', 'icons'), { recursive: true });
// The backend can be installed as its own app (with its own icon) on a phone or computer. It is the same page; nothing is cached.
fs.writeFileSync(path.join(site, 'admin', 'manifest.webmanifest'), JSON.stringify({ id: '/admin/', name: 'Phoenix backend', short_name: 'Phoenix Admin', description: 'The private Phoenix backend: users, usage and wellbeing trends. Admin sign-in required.', lang: 'en-GB', start_url: './', scope: './', display: 'standalone', orientation: 'any', background_color: '#120d22', theme_color: '#120d22', prefer_related_applications: false, icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] }, null, 2));
fs.copyFileSync(path.join(root, 'scripts', 'site-assets', 'admin-pdf.js'), path.join(site, 'admin', 'admin-pdf.js')); // the PDF report is drawn in the admin's own browser
fs.copyFileSync(path.join(root, 'app', 'vendor', 'pdf-lib.esm.min.js'), path.join(site, 'admin', 'pdf-lib.esm.min.js'));
// /embed/ is the app itself (so every relative file it loads still works), served on its own address so it alone may be shown inside other websites.
fs.writeFileSync(path.join(site, '_redirects'), '/stats /admin/ 301\n/stats/* /admin/ 301\n/embed/ /app/index.html 200\n/embed/* /app/:splat 200\n');

fs.writeFileSync(path.join(site, '_headers'), `/app/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors 'self'
/embed/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors *
/backend/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex, nofollow
  Content-Security-Policy: frame-ancestors 'none'
/desktop/*
  Cache-Control: no-cache
  X-Robots-Tag: noindex
  Content-Security-Policy: frame-ancestors 'none'
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
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
/admin/manifest.webmanifest
  Content-Type: application/manifest+json
  Cache-Control: no-cache
/sitemap.xml
  Content-Type: application/xml; charset=utf-8
  Cache-Control: public, max-age=3600
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`);
console.log('site built:', Object.keys(pageMap).length, 'pages, the app, the widget, sitemap.xml, robots.txt');