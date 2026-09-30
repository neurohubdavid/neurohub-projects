// The website's pages (landing, privacy, accessibility), written for people first and for search engines second:
// one clear h1 per page, a descriptive title and meta description, a canonical address, Open Graph and Twitter cards,
// structured data (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList), and real content that answers the
// questions people search for. Used by scripts/build-site.mjs.
export const ORIGIN = 'https://phoenix.neurohubcommunity.org';
const ORG = { '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'NeuroHub Community Ltd', url: 'https://neurohubcommunity.org', logo: `${ORIGIN}/assets/icon-512.png` };

export const FAQ = [
  ['Is Phoenix really free?', 'Yes. Phoenix is free to use, with no account, no ads and no subscription, and you do not need your own AI key. It is made by NeuroHub Community, an Autistic-led social enterprise, and donations help keep it free. The free AI has a daily limit for each person; if you connect your own paid AI key, you pay that provider directly and Phoenix adds nothing on top.'],
  ['Is Phoenix private?', 'Your chats, daily check-ins and settings are stored on your own device, not on a NeuroHub server, and there is no account. Phoenix starts with its free AI, so your messages go to NeuroHub’s server and on to Claude to write a reply, without being stored or read; you can switch to the built-in helper or an AI on your own computer (Ollama) in Settings, and then nothing leaves your device. If you choose your own online AI, only the messages you send go to that provider. NeuroHub counts anonymous visits, installs and downloads, with no cookies and nothing that identifies you.'],
  ['Is Phoenix therapy, or a crisis service?', 'No. Phoenix is a computer program, not a therapist, doctor or crisis service, and it cannot diagnose you. It offers information, calming tools and a place to think things through. A red Help button is always visible and shows helplines and emergency numbers for your country. If you are in danger, call your local emergency number.'],
  ['What does neuro-affirming mean here?', 'Phoenix treats Autistic, ADHD, AuDHD and other neurodivergent minds as different, not broken. It never tells you to mask more, comply, or try harder. It looks first at the environment, the demands and the people around you, and it draws on the Six-Point Framework and other ideas developed by NeuroHub Community and by Autistic writers.'],
  ['What can Phoenix help with?', 'Autistic burnout and overwhelm, sensory overload, meltdowns and shutdowns, getting started on tasks (executive function), masking, energy and daily routines, and understanding your own patterns. There is a daily wellbeing check-in with charts over time, a calming toolkit (breathing, grounding, sensory reset, focus timer, task breaker, scripts for hard messages), and guided documents such as a burnout recovery plan that you can download as a PDF.'],
  ['Does Phoenix work offline?', 'Yes. Once installed, the built-in helper, the toolkit, your check-ins and the learning topics all work without internet. An AI that runs on your own computer also works offline. Online AI options need a connection.'],
  ['Which AI does Phoenix use?', 'Nothing to set up: Phoenix’s free AI, run by NeuroHub Community with a daily limit, writes replies using Claude. If you would rather keep everything on your device, use the built-in helper (no AI) or connect a private AI that runs on your own computer (Ollama). You can also use your own key for Claude, Google Gemini, Groq and others. Very small models can be unreliable, so Phoenix answers medicine and crisis questions itself instead of leaving them to the model.'],
  ['How do I install Phoenix on my phone or computer?', 'Open Phoenix in your browser and press Install. On Android use Chrome and choose Install app. On iPhone or iPad use Safari, tap Share, then Add to Home Screen. On Windows, Mac and Linux use Edge or Chrome and press the Install button or the install icon in the address bar. Nothing to download and no app store.'],
  ['Is Phoenix only for Autistic people?', 'No. It was designed for Autistic people first and works for ADHD, AuDHD, dyslexic, dyspraxic and other neurodivergent people, and for anyone exploring whether these describe them. You can tell Phoenix how you like to be spoken to in Settings.'],
];

const CSS = `
@font-face{font-family:'Atkinson Hyperlegible';font-weight:400;font-display:swap;src:url(/assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2) format('woff2')}
@font-face{font-family:'Atkinson Hyperlegible';font-weight:700;font-display:swap;src:url(/assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2) format('woff2')}
@font-face{font-family:'Lilita One';font-weight:400;font-display:swap;src:url(/assets/fonts/lilita-one-latin-400-normal.woff2) format('woff2')}
:root{--bg:#fffbf2;--card:#fff;--text:#16121f;--muted:#55506b;--border:#16121f;--accent:#a66bff;--lime:#b8f557;--link:#6d35d6;--warn:#fff3d1}
@media (prefers-color-scheme:dark){:root{--bg:#120f1c;--card:#1d1833;--text:#f4f0ff;--muted:#bdb5d6;--border:#cdbdff;--accent:#b98aff;--link:#cdb6ff;--warn:#3a300f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:1.06rem/1.65 'Atkinson Hyperlegible',system-ui,sans-serif}
main{max-width:52rem;margin:0 auto;padding:1rem 1rem 4rem}
h1,h2,h3{font-family:'Lilita One','Atkinson Hyperlegible',sans-serif;font-weight:400;line-height:1.15}
h1{font-size:clamp(1.9rem,6vw,3rem);margin:.3em 0}h2{font-size:1.7rem;margin:2em 0 .5em}h3{margin:0 0 .3em;font-size:1.25rem}
a{color:var(--link);text-underline-offset:3px}:focus-visible{outline:3px solid var(--link);outline-offset:3px;border-radius:6px}
.skip{position:absolute;left:-999px;top:8px;background:var(--card);padding:.6rem 1rem;border:2.5px solid var(--border);border-radius:10px;z-index:9}.skip:focus{left:8px}
.top{max-width:52rem;margin:0 auto;padding:.8rem 1rem;display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}
.top a.brand{display:flex;align-items:center;gap:.6rem;font-family:'Lilita One',sans-serif;font-size:1.4rem;color:var(--text);text-decoration:none}.top img{border-radius:.6rem}
.top nav{display:flex;gap:1.1rem;flex-wrap:wrap}.top nav a{font-weight:700}
.hero{display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap}.hero img{width:9rem;height:9rem;border-radius:1.5rem}
.card{background:var(--card);border:2.5px solid var(--border);border-radius:16px;box-shadow:4px 4px 0 var(--border);padding:1.1rem 1.25rem;margin:1rem 0}
.dl{display:flex;gap:1rem;align-items:center;justify-content:space-between;flex-wrap:wrap}.dl p{margin:.2em 0;color:var(--muted)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:.7em 1.4em;border:2.5px solid var(--border);border-radius:999px;background:var(--card);color:var(--text);font-weight:700;text-decoration:none;box-shadow:3px 3px 0 var(--border)}
.btn:hover{transform:translate(-1px,-1px)}.btn-primary{background:var(--lime);color:#16121f}.btn-big{min-height:56px;font-size:1.15rem;padding:.8em 1.8em}
.install-hero{border-color:var(--link);background:color-mix(in srgb,var(--lime) 22%,var(--card));text-align:center}.install-hero h2{margin-top:0}.btn-huge{min-height:64px;font-size:1.4rem;padding:.8em 2.2em}#install-help{margin:.6rem auto 0;max-width:34rem;text-align:left}#install-help ol{margin:.4rem 0;padding-left:1.4rem;font-size:1.1rem}.install-hero .steps{text-align:left;margin-top:.8rem}.steps details{margin:.4rem 0}.steps summary{color:var(--text);font-weight:700}.dl-more>summary{color:var(--text)}
code{font:.82rem ui-monospace,Consolas,monospace;word-break:break-all;display:block;margin-top:.4rem}summary{cursor:pointer;color:var(--muted);font-size:.92rem}
.notice{background:var(--warn);border:2px solid var(--border);border-radius:10px;padding:.8rem 1rem}
.grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr))}.grid .card{margin:0}
.faq details{margin:.5rem 0;padding:.6rem 1rem;background:var(--card);border:2px solid var(--border);border-radius:12px}.faq summary{color:var(--text);font-weight:700;font-size:1.05rem}.faq p{margin:.6rem 0 .2rem}
.muted{color:var(--muted)}footer{max-width:52rem;margin:0 auto;padding:0 1rem 3rem;color:var(--muted);font-size:.92rem}footer a{margin-right:1rem}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
section[id],h2[id]{scroll-margin-top:1rem}summary{padding:.55em 0;min-height:44px}img{max-width:100%;height:auto}
.top nav a{display:inline-flex;align-items:center;min-height:44px}.nav-donate{padding:0 .9em;border:2px solid var(--border);border-radius:999px;background:color-mix(in srgb,#f6a7dc 55%,var(--card));color:var(--text);text-decoration:none}
.donate-strip{border-color:#d6246e;background:color-mix(in srgb,#f6a7dc 26%,var(--card));text-align:center}.donate-strip h2{margin-top:0;font-size:1.45rem}
.amounts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.6rem;margin:.6rem auto;max-width:34rem}.amounts .btn{padding:.6em .4em;font-size:1.15rem;min-height:52px}
.dock{display:none}
@media (max-width:640px){
  body{font-size:1.05rem}main{padding:.5rem .9rem 6rem}.top{padding:.6rem .9rem}.top nav{gap:.35rem .8rem;font-size:.95rem}
  .hero{flex-direction:row;flex-wrap:nowrap;text-align:left;gap:.8rem;align-items:center}.hero>div{min-width:0;flex:1}.hero img{width:4.5rem;height:4.5rem;flex:none}.top{padding:.4rem .9rem}.top nav a:not(.nav-donate){display:none}.top img{width:32px;height:32px}.hero .lead{display:none}.hero .muted{font-size:.9rem}h1{font-size:1.45rem;margin:.1em 0}h2{font-size:1.45rem;margin-top:1.6em}
  .btn-huge{width:100%;font-size:1.3rem}.install-hero .btn{width:100%;margin:.25rem 0}.install-hero p{margin:.6rem 0}
  .amounts{grid-template-columns:repeat(2,minmax(0,1fr))}.card{padding:1rem}.dl{flex-direction:column;align-items:stretch}
  .dock{display:flex;gap:.6rem;position:fixed;left:0;right:0;bottom:0;z-index:20;padding:.6rem .9rem calc(.6rem + env(safe-area-inset-bottom));background:color-mix(in srgb,var(--bg) 92%,transparent);backdrop-filter:blur(6px);border-top:2.5px solid var(--border)}.dock .btn{flex:1;min-height:52px;font-size:1.05rem;padding:.5em .6em}
  footer{padding-bottom:5.5rem}
}`;

export function layout({ path, title, description, body, jsonld = [], noindex = false, crumbs = [] }) {
  const url = ORIGIN + path, esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const graph = [...jsonld];
  if (crumbs.length) graph.push({ '@type': 'BreadcrumbList', itemListElement: [{ name: 'Phoenix', path: '/' }, ...crumbs].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: ORIGIN + c.path })) });
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="manifest" href="/app/manifest.webmanifest">
<link rel="apple-touch-icon" href="/app/icons/apple-touch-icon.png">
<meta name="theme-color" content="#a66bff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Phoenix by NeuroHub Community">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${ORIGIN}/assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Phoenix, a colourful raptor-style phoenix mascot, with the words: free neuro-affirming AI assistant">
<meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${ORIGIN}/assets/og-image.png">
<link rel="preload" href="/assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
${graph.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>` : ''}
<style>${CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/"><img src="/assets/icon-192.png" alt="" width="40" height="40"> Phoenix</a>
  <nav aria-label="Main"><a href="/#install">Install</a><a href="/#faq">Questions</a><a href="/accessibility/">Accessibility</a><a href="/privacy/">Privacy</a><a class="nav-donate" href="/#donate">&hearts; Donate</a></nav>
</header>
<main id="main">
${body}
</main>
<footer>
  <p><a href="/">Phoenix</a><a href="/privacy/">Privacy</a><a href="/accessibility/">Accessibility</a><a href="https://neurohubcommunity.org">NeuroHub Community</a><a href="https://ko-fi.com/neurohubcommunity" rel="noopener">Donate</a></p>
  <p>Made by NeuroHub Community Ltd. The software is MIT licensed. Phoenix is not a therapist, doctor or crisis service and cannot diagnose. If you are in danger, call your local emergency number.</p>
</footer>
<div class="dock" role="navigation" aria-label="Quick actions"><a class="btn btn-primary" href="/#install">Install</a><a class="btn" href="/#donate">&hearts; Donate</a></div>
<script src="/assets/hit.js" defer></script>
<script src="/assets/install.js" defer></script>
</body>
</html>
`;
}

export function pages({ version, downloads, hasDownloads, esc }) {
  const app = { '@type': 'SoftwareApplication', '@id': `${ORIGIN}/#app`, name: 'Phoenix', alternateName: 'Phoenix neuro-affirming AI assistant', url: ORIGIN + '/', applicationCategory: 'HealthApplication', applicationSubCategory: 'Neurodivergent wellbeing support', operatingSystem: 'Web, Android, iOS, Windows, macOS, Linux, ChromeOS', softwareVersion: version, inLanguage: 'en-GB', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, publisher: { '@id': `${ORIGIN}/#org` }, image: `${ORIGIN}/assets/og-image.png`, screenshot: [`${ORIGIN}/assets/og-image.png`], description: 'A free, private, neuro-affirming AI assistant for Autistic, ADHD and AuDHD people, with daily check-ins, burnout and overwhelm support, and calming tools. Installs as an app on any device.', featureList: ['Neuro-affirming AI assistant', 'Daily wellbeing check-in with charts over time', 'Burnout recovery plan and self-reflection documents as PDF', 'Breathing, grounding and sensory reset tools', 'Works offline', 'Accessibility settings: fonts, spacing, colours, voice', 'Bring your own AI, or run one privately on your own computer', 'No account, data stored on your device'] };
  const site = { '@type': 'WebSite', '@id': `${ORIGIN}/#site`, url: ORIGIN + '/', name: 'Phoenix by NeuroHub Community', inLanguage: 'en-GB', publisher: { '@id': `${ORIGIN}/#org` } };
  const faq = { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };

  const home = layout({
    path: '/',
    title: 'Phoenix: free AI assistant for Autistic and ADHD people',
    description: 'Free, private, neuro-affirming AI assistant for Autistic, ADHD and AuDHD people: daily check-ins, burnout and overwhelm support, calming tools. Install in one tap.',
    jsonld: [ORG, site, app, faq],
    body: `
  <div class="hero">
    <img src="/assets/icon-512.png" width="144" height="144" alt="Phoenix, a colourful raptor-style phoenix, the mascot of the free neuro-affirming AI assistant">
    <div>
      <p class="muted" style="margin:0">By NeuroHub Community</p>
      <h1>Phoenix: a free, neuro-affirming AI assistant for Autistic and ADHD people</h1>
      <p class="lead" style="font-size:1.2rem;margin:0">Support for burnout, overwhelm and everyday life that does not ask you to mask, comply or try harder. Private by design, works offline, and installs as an app on your phone or computer.</p>
    </div>
  </div>

  <section id="install" class="card install-hero" aria-labelledby="install-h">
    <h2 id="install-h">Install Phoenix on this device</h2>
    <p>One tap. No app store, no account, no download to hunt for. It gets its own icon, works offline, and keeps your data on your device. Version ${esc(version)}, free.</p>
    <p><a id="install-now" class="btn btn-primary btn-huge" href="/app/?install=1">Install Phoenix</a> <a class="btn" href="/app/">Open in the browser instead</a></p>
    <div id="install-help" aria-live="polite"></div>
    <details class="steps"><summary>Step-by-step help for each device</summary>
      <details open><summary>Windows, Mac, Linux, Chromebook (Edge or Chrome)</summary><p>Press <strong>Install Phoenix</strong> above, then <strong>Install</strong> in the box your browser shows. Or use the install icon at the right of the address bar, or Edge’s <strong>Settings and more (…) → Apps → Install this site as an app</strong>. Afterwards find Phoenix in your Start menu or Applications.</p></details>
      <details><summary>Android (Chrome)</summary><p>Press <strong>Install Phoenix</strong> above, then <strong>Install</strong>. Or open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></details>
      <details><summary>iPhone and iPad (Safari)</summary><p>Open this page in <strong>Safari</strong> (not inside another app’s browser). Tap the <strong>Share</strong> button (a square with an arrow), scroll down and choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. Open Phoenix from your Home Screen.</p></details>
      <details><summary>Mac Safari</summary><p>Choose <strong>File → Add to Dock</strong>.</p></details>
      <details><summary>Nothing happens, or there is no Install button?</summary><p>Phoenix may already be installed (look in your Start menu or Apps list). Private or incognito windows cannot install apps. Firefox on a computer cannot install web apps, so use Edge or Chrome. In the app, open <strong>Settings → Install as an app → Install not working? Check why</strong>.</p></details>
    </details>
  </section>  <section id="donate" class="card donate-strip" aria-labelledby="donate-h">
    <h2 id="donate-h">&hearts; Phoenix is free. If you can, help keep it that way.</h2>
    <p>NeuroHub Community, a small Autistic-led social enterprise, pays for Phoenix. A donation of any size helps, and there is never any pressure.</p>
    <p class="amounts"><a class="btn" data-amount="5" href="https://paypal.biz/emergentdivergence" rel="noopener">£5</a><a class="btn" data-amount="10" href="https://paypal.biz/emergentdivergence" rel="noopener">£10</a><a class="btn" data-amount="25" href="https://paypal.biz/emergentdivergence" rel="noopener">£25</a><a class="btn" data-amount="50" href="https://paypal.biz/emergentdivergence" rel="noopener">£50</a></p>
    <p class="muted" style="margin:.4rem 0 0;font-size:.95rem">These amounts are suggestions: PayPal opens, and you type what you would like to give. <a data-amount="other" href="https://ko-fi.com/neurohubcommunity" rel="noopener">Prefer Ko-fi?</a></p>
  </section>
${hasDownloads ? `  <details class="card dl-more"><summary><strong>Prefer a classic Windows or Linux program? (optional downloads)</strong></summary>
${downloads}
  <div class="notice"><strong>Windows shows a warning?</strong> These early builds are not yet code-signed, so Windows SmartScreen may say “Windows protected your PC”. Choose <strong>More info</strong>, then <strong>Run anyway</strong>. You can check the file is genuine by comparing its SHA-256 checksum (above) with the one you get from PowerShell: <code>Get-FileHash .\\Phoenix-Setup-${esc(version)}-x64.exe</code></div>
  </details>` : ''}

  <h2>What Phoenix helps with</h2>
  <p>Phoenix is an AI assistant built around how many Autistic, ADHD and AuDHD people actually experience the world. It can help you make sense of <strong>autistic burnout</strong>, <strong>sensory overload</strong>, <strong>meltdowns and shutdowns</strong>, <strong>masking</strong>, low energy and the difficulty of getting started, and it offers practical, low-demand steps instead of advice to push harder.</p>
  <div class="grid">
    <div class="card"><h3>Neuro-affirming</h3><p>Built on the Six-Point Framework and other ideas from NeuroHub Community. It treats neurodivergence as difference, not deficit, and never tells you to mask more, comply, or “try harder”.</p></div>
    <div class="card"><h3>Daily check-in</h3><p>A two-minute wellbeing check-in across six areas of life, with charts that show how you are doing over time, gentle advice, and an optional daily reminder.</p></div>
    <div class="card"><h3>Calming toolkit</h3><p>Breathing, grounding, sensory reset, a focus timer with company, a task breaker, scripts for hard messages and a personal support plan. All work with no AI and no internet.</p></div>
    <div class="card"><h3>Your own documents</h3><p>Fill in a burnout recovery plan, a six-area self-assessment or an identity workbook with Phoenix’s help, then download it as a PDF to keep or share.</p></div>
    <div class="card"><h3>Free AI, no setup</h3><p>Chat with Phoenix’s free AI straight away, or keep everything on your device with the built-in helper or a private AI on your own computer (Ollama). You can also bring your own key, and then <strong>you pay your provider directly</strong>.</p></div>
    <div class="card"><h3>Accessibility built in</h3><p>Choose your font (including Lexend and OpenDyslexic), text size, line, letter and word spacing, colours, and the speech voice, speed and pitch. <a href="/accessibility/">See all accessibility features</a>.</p></div>
  </div>

  <h2>Your data stays yours</h2>
  <p>Phoenix has no account and stores your chats, check-ins and settings on your own device. You can download a backup, restore one, or delete everything from Settings. An AI on your own computer never sends anything anywhere. <a href="/privacy/">Read the plain-language privacy page</a>.</p>

  <h2>Safety</h2>
  <p>Phoenix is a computer program. It is not a therapist, doctor or crisis service, and it cannot diagnose. The red <strong>Help</strong> button is always visible and shows helplines and emergency numbers for your country. If you are in danger, call your local emergency number.</p>

  <h2 id="faq">Questions people ask</h2>
  <div class="faq">
${FAQ.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </div>

  <h2>Support NeuroHub Community</h2>
  <p>Phoenix is free because NeuroHub Community, a small Autistic-led social enterprise, makes it. If it has helped, you can <a href="https://paypal.biz/emergentdivergence" rel="noopener">donate through PayPal</a> or <a href="https://ko-fi.com/neurohubcommunity" rel="noopener">Ko-fi</a>. There is never any pressure. To read more, visit <a href="https://neurohubcommunity.org">neurohubcommunity.org</a>, <a href="https://connect.neurohubcommunity.org/p/join">join the community</a>, or see <a href="https://mybook.to/dgh-full-catalogue">David Gray-Hammond’s books</a>.</p>`,
  });

  const privacy = layout({
    path: '/privacy/', title: 'Privacy: how Phoenix treats your data', description: 'Plain-language privacy for Phoenix, the free neuro-affirming AI assistant: chats and check-ins stay on your device, no account, no cookies.',
    crumbs: [{ name: 'Privacy', path: '/privacy/' }], jsonld: [ORG],
    body: `
  <h1>Privacy</h1>
  <p class="muted">In plain words. Last updated 30 September 2026.</p>
  <h2>What stays on your device</h2>
  <p>Your chats, daily check-ins, documents, tasks, settings and any API key you type in are stored on your own device only, in the app or browser you use. There is no Phoenix account and NeuroHub Community cannot read or recover them. You can download a backup or delete everything at any time in Settings.</p>
  <h2>What the AI sees</h2>
  <ul>
    <li><strong>Built-in helper:</strong> nothing leaves your device.</li>
    <li><strong>An AI on your own computer (Ollama, LM Studio):</strong> nothing leaves your computer.</li>
    <li><strong>Phoenix free AI (limited), where new people start:</strong> your messages go to NeuroHub Community’s server, which passes them to Anthropic’s Claude to write a reply. They are not stored or logged by NeuroHub. Only anonymous counters are kept to enforce a daily limit. Your daily check-ins are not sent unless you allow it. You can opt out at any time in Settings by choosing the built-in helper or another AI.</li>
    <li><strong>Your own key (Claude, Gemini, Groq and others):</strong> your messages go from your device straight to that provider under its own terms. Free tiers may use conversations to improve their products, so avoid personal details.</li>
  </ul>
  <h2>Sharing check-in scores (optional, off by default)</h2>
  <p>If you are 16 or over, Settings lets you choose to share your daily check-in scores with NeuroHub Community Ltd, so we can see how people are doing over time and what helps. <strong>You have to turn it on yourself</strong>, and nothing is shared before that.</p>
  <ul>
    <li><strong>What is sent:</strong> the date and seven whole numbers from 1 to 5 (your overall score and the six areas) each time you check in, with a random ID made on your own device to link them. That is all.</li>
    <li><strong>What is never sent:</strong> your name, anything you write (notes, chats, documents, what you plan to protect), your location, IP address or device details.</li>
    <li><strong>Who can see it:</strong> only people at NeuroHub who have been given the Admin role and who sign in with a password and a code from an authenticator app. Results are shown as group trends. Individual lines appear with anonymous labels, and only once at least five people share, so nobody can be picked out.</li>
    <li><strong>Why:</strong> to understand wellbeing and improve Phoenix. We may publish combined, anonymous findings, never anything about one person.</li>
    <li><strong>Legal basis and your rights:</strong> your explicit consent, which you can withdraw at any time in Settings. Because the scores are about wellbeing they count as health information, so we treat them with extra care. NeuroHub Community Ltd is the data controller. You can stop sharing, and delete everything you have shared, with one tap in Settings. Scores are deleted after two years at the latest. Because we hold no name or contact details, we can only find your data through the ID on your device.</li>
    <li><strong>Not a safety net:</strong> nobody watches this live and we cannot contact you, so it is not a way to get help. If you are struggling, use the red Help button.</li>
  </ul>
  <h2>Anonymous counts</h2>
  <p>To learn how many people find and use Phoenix, NeuroHub counts visits to this website, clicks on Install and download, app opens and installs. It stores only daily totals, plus a coarse device type (for example Android or Windows), a country code and the website that referred you. It uses no cookies and stores no IP address, no identifier, no message or health information. If your browser sends Do Not Track or Global Privacy Control, nothing is counted. In the app you can switch counting off in Settings, under Your data.</p>
  <h2>The website and the host</h2>
  <p>This website is hosted by Netlify, which may keep ordinary server logs (such as IP addresses) for a short time for security and operation. NeuroHub does not use them to identify visitors.</p>
  <h2>Other people’s details</h2>
  <p>Phoenix’s built-in knowledge comes from NeuroHub’s books, articles, training and talks, with the names and personal details of individuals removed.</p>
  <h2>Contact</h2>
  <p>Questions or requests: <a href="https://neurohubcommunity.org/contact-us/">neurohubcommunity.org/contact-us</a>.</p>`,
  });

  const access = layout({
    path: '/accessibility/', title: 'Accessibility features in Phoenix', description: 'Accessibility in Phoenix, the neuro-affirming AI assistant: dyslexia-friendly fonts, spacing, calm and high-contrast colours, reduced motion, speech.',
    crumbs: [{ name: 'Accessibility', path: '/accessibility/' }], jsonld: [ORG],
    body: `
  <h1>Accessibility in Phoenix</h1>
  <p>Phoenix is made by an Autistic-led organisation, and accessibility is part of the design. Press <strong>Alt + A</strong> or the <strong>Aa</strong> button in the app at any time to change any of these.</p>
  <h2>Reading</h2>
  <ul><li>Fonts: Atkinson Hyperlegible, Lexend, OpenDyslexic, your system font, serif or monospace.</li><li>Text size, line spacing, letter spacing and word spacing.</li><li>Bold text, a narrower reading column, underlined links and a larger focus outline.</li></ul>
  <h2>Colour and motion</h2>
  <ul><li>Themes: automatic, light, dark, calm (softer, no hard shadows) and high contrast.</li><li>Reduced motion, which also stops the mascot’s animations.</li><li>Colours are never the only signal: charts use different line patterns and show the numbers, and every chart has a text description and a table.</li></ul>
  <h2>Sound and speech</h2>
  <ul><li>Replies can be read aloud, with your choice of voice, speed, pitch and volume.</li><li>You can speak to Phoenix where your browser supports it.</li><li>Literal language mode removes idioms and sarcasm.</li></ul>
  <h2>Keyboard and screen readers</h2>
  <ul><li>Everything can be used with a keyboard, with a skip link and visible focus.</li><li>Buttons and controls have text labels, forms have labels, and updates are announced politely.</li></ul>
  <h2>Low-demand by design</h2>
  <ul><li>Every question is optional, and you can stop any time.</li><li>Short replies by default, with the length and tone of replies in your control.</li><li>The daily reminder is one gentle notification, never repeated, and easy to switch off.</li></ul>
  <p class="muted">We aim to meet WCAG 2.2 AA where we can. Phoenix has been tested by its makers, but has not yet had a formal external audit. If something is hard to use, please tell us through <a href="https://neurohubcommunity.org/contact-us/">neurohubcommunity.org/contact-us</a> and we will fix it.</p>`,
  });
  return { '/': home, '/privacy/': privacy, '/accessibility/': access };
}
