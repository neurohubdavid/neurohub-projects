// The website's pages (landing, privacy, accessibility), written for people first and for search engines second:
// one clear h1 per page, a descriptive title and meta description, a canonical address, Open Graph and Twitter cards,
// structured data (Organization, WebSite, SoftwareApplication, FAQPage, BreadcrumbList), and real content that answers the
// questions people search for. Used by scripts/build-site.mjs.
import { LINKS, AMOUNTS, KOFI, usingStripe } from '../app/js/donate-links.js';
export const ORIGIN = 'https://phoenix.neurohubcommunity.org';

/** The donate box near the top of the front page. Plain links that work without JavaScript (one-off amounts); assets/donate.js adds the once/monthly switch. */
function donateStrip() {
  const link = (a) => `<a class="btn" data-amount="${a}" data-once="${LINKS.once[a]}" data-monthly="${LINKS.monthly[a]}" href="${LINKS.once[a]}" rel="noopener">${a === 'other' ? 'Choose my own amount' : '£' + a}</a>`;
  return `  <section id="donate" class="card donate-strip" aria-labelledby="donate-h">
    <h2 id="donate-h">&hearts; Help keep Phoenix's AI running</h2>
    <p>Phoenix is free to use. NeuroHub Community, a small Autistic-led social enterprise, pays for every AI reply. A donation of any size helps cover that cost, and there is never any pressure.</p>
    <div class="freq" role="group" aria-label="How often" hidden><button type="button" class="btn" data-freq="once" aria-pressed="true">Give once</button><button type="button" class="btn" data-freq="monthly" aria-pressed="false">Give monthly</button></div>
    <p class="amounts">${AMOUNTS.map(link).join('')}</p>
    <p class="amounts other">${link('other')}</p>
    <p class="muted" style="margin:.4rem 0 0;font-size:.95rem" id="donate-note">${usingStripe() ? 'Each button opens a secure payment page run by Stripe, with the amount already filled in. You can change it there.' : 'Each button opens our donation page, where you choose the amount and can pay by card.'} <a data-amount="other" href="${KOFI}" rel="noopener">Prefer Ko-fi?</a></p>
  </section>`;
}
const ORG = { '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'NeuroHub Community Ltd', url: 'https://neurohubcommunity.org', logo: `${ORIGIN}/assets/icon-512.png` };

export const FAQ = [
  ['Does the Phoenix desktop program send my voice anywhere?', 'No. The desktop program for Windows turns what its microphone hears into text on your own computer, using an open speech engine that works offline, so your voice never leaves your computer. Only the words go to Phoenix, like a message you typed, and Phoenix keeps no audio. It only listens while you are talking to Phoenix or, if you turn it on, listening for the word “Phoenix”, you can see in its tray menu when the microphone is in use, and you can switch the microphone off for good from there. Because it is a small English model it will sometimes mishear you. In a browser, voice input uses your browser’s own speech recognition instead, which in Chrome and Edge sends your speech to Google or Microsoft.'],
  ['Can I choose Phoenix’s pronouns, and tell Phoenix mine?','Yes. In Settings, under Pronouns, you pick what Phoenix is called (she/her, he/him or they/them) and, if you like, your own, including your own words. Phoenix is an AI, so there is no right answer: it is whatever feels comfortable. Phoenix then uses your choice in the app, and uses yours if it ever talks about you in the third person.'],
  ['Does Phoenix recommend products or courses?', 'Sometimes, gently, and only from websites Phoenix has permission to use: NeuroHub Community and Helen Edgar’s Autistic Realms and More Realms. Phoenix reads their public sitemaps to know what guides, courses, books and products exist. When something really fits what you are dealing with, and you are not in a hard moment, Phoenix may mention one thing, say who made it and what it costs, and link it. These are made by the people behind Phoenix, so it is not independent advice. You can switch suggestions off in Settings, or ask “any resources that could help?” whenever you like.'],
  ['Can I just say “Phoenix” to start talking?', 'Yes, if you have a free Phoenix account, have installed Phoenix as an app, and switch it on in Settings. Then saying “Phoenix” (or “Hey Phoenix, I feel overwhelmed”) starts a spoken conversation: Phoenix listens, answers out loud and listens again. It is off by default. While it is on the microphone stays open whenever the app is, and in Chrome and Edge your browser sends what it hears to Google or Microsoft to turn into text. Phoenix keeps no audio and ignores anything that does not start with the name.'],
  ['Can Phoenix float on my screen while I work?', 'Yes, on a computer with Microsoft Edge or Google Chrome. Install Phoenix, press Float, then minimise it: Phoenix stays in a small window on top of your other programs, animated and ready to help with what you are doing, chat, or talk with you out loud (press Talk). Tell Phoenix what you are working on, because Phoenix cannot see your screen. When you come back to Phoenix, the floating window closes and Phoenix comes home too. Phones, Firefox and Safari cannot float windows over other programs.'],
  ['Is there a Windows or Mac program to download?', 'No. Phoenix is an app you install straight from your browser in one tap, with no store and no installer file. It gets its own icon and window, works offline, and updates itself. Press Install Phoenix on this page.'],
  ['Is Phoenix really free?', 'Yes. Phoenix is free to use, with no account needed, no ads and no subscription, and you do not need an AI account or key. It is made by NeuroHub Community, an Autistic-led social enterprise. Every AI reply is paid for by NeuroHub from our own Claude account, so the AI has a daily limit for each person, and donations (once or monthly, any amount) are what keep it live.'],
  ['Is Phoenix private?', 'Your chats, daily check-ins and settings are stored on your own device, not on a NeuroHub server, unless you choose to make an optional account to sync them between your devices (then they are stored scrambled with a key only the server holds, and your email address is never stored). Phoenix starts with its free AI, so your messages go to NeuroHub’s server and on to Claude to write a reply, without being stored or read; you can switch to the built-in helper in Settings, and then nothing leaves your device. NeuroHub counts anonymous visits, installs and downloads, with no cookies and nothing that identifies you.'],
  ['Is Phoenix therapy, or a crisis service?', 'No. Phoenix is a computer program, not a therapist, doctor or crisis service, and it cannot diagnose you. It offers information, calming tools and a place to think things through. A red Help button is always visible and shows helplines and emergency numbers for your country. If you are in danger, call your local emergency number.'],
  ['What does neuro-affirming mean here?', 'Phoenix treats Autistic, ADHD, AuDHD and other neurodivergent minds as different, not broken. It never tells you to mask more, comply, or try harder. It looks first at the environment, the demands and the people around you, and it draws on the Six-Point Framework and other ideas developed by NeuroHub Community and by Autistic writers.'],
  ['What can Phoenix help with?', 'Autistic burnout and overwhelm, sensory overload, meltdowns and shutdowns, getting started on tasks (executive function), masking, energy and daily routines, and understanding your own patterns. There is a daily wellbeing check-in with charts over time, a calming toolkit (breathing, grounding, sensory reset, focus timer, task breaker, scripts for hard messages), and guided documents such as a burnout recovery plan that you can download as a PDF.'],
  ['Does Phoenix work offline?', 'Yes. Once installed, the built-in helper, the toolkit, your check-ins and the learning topics all work without internet. Phoenix AI needs internet, because the replies are written online. Without internet the built-in helper still answers. need a connection.'],
  ['Which AI does Phoenix use?', 'Nothing to set up: Phoenix’s free AI, run by NeuroHub Community with a daily limit, writes replies using Claude, on NeuroHub’s own account, so there is nothing to set up and nothing to pay. If you would rather keep everything on your device, use the built-in helper (no AI). Phoenix answers medicine and crisis questions itself instead of leaving them to the model.'],
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
.amounts.other{grid-template-columns:1fr;margin-top:0}.freq{display:flex;justify-content:center;gap:.5rem;margin:.6rem 0}.freq[hidden]{display:none}.freq .btn{min-height:44px;padding:.4em 1.2em;box-shadow:none}.freq .btn[aria-pressed=true]{background:var(--accent);color:#16121f}
.sr-only{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
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
<script src="/assets/donate.js" defer></script>
</body>
</html>
`;
}

export function pages({ version, esc }) {
  const app = { '@type': 'SoftwareApplication', '@id': `${ORIGIN}/#app`, name: 'Phoenix', alternateName: 'Phoenix neuro-affirming AI assistant', url: ORIGIN + '/', applicationCategory: 'HealthApplication', applicationSubCategory: 'Neurodivergent wellbeing support', operatingSystem: 'Web, Android, iOS, Windows, macOS, Linux, ChromeOS', softwareVersion: version, inLanguage: 'en-GB', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' }, publisher: { '@id': `${ORIGIN}/#org` }, image: `${ORIGIN}/assets/og-image.png`, screenshot: [`${ORIGIN}/assets/og-image.png`], description: 'A free, private, neuro-affirming AI assistant for Autistic, ADHD and AuDHD people, with daily check-ins, burnout and overwhelm support, and calming tools. Installs as an app on any device.', featureList: ['Neuro-affirming AI assistant', 'Daily wellbeing check-in with charts over time', 'Burnout recovery plan and self-reflection documents as PDF', 'Breathing, grounding and sensory reset tools', 'Works offline', 'Accessibility settings: fonts, spacing, colours, voice', 'Free Claude-powered AI, kept live by donations', 'No account, data stored on your device'] };
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
    <h2 id="install-h">Install Phoenix as an app</h2>
    <p>One tap. No app store, no account needed, no installer to download. Phoenix gets its own icon and window, works offline, updates itself, and keeps your data on your device. On a computer it can also <strong>float on your screen beside your work</strong> when you minimise it. Free.</p>
    <p><a id="install-now" class="btn btn-primary btn-huge" href="/app/?install=1">Install Phoenix</a> <a class="btn" href="/app/">Open in the browser instead</a> </p>
    <div id="install-help" aria-live="polite"></div>
    <details class="steps"><summary>Step-by-step help for each device</summary>
      <details open><summary>Windows, Mac, Linux, Chromebook (Edge or Chrome)</summary><p>Press <strong>Install Phoenix</strong> above, then <strong>Install</strong> in the box your browser shows. Or use the install icon at the right of the address bar, or Edge’s <strong>Settings and more (…) → Apps → Install this site as an app</strong>. Afterwards find Phoenix in your Start menu or Applications.</p></details>
      <details><summary>Android (Chrome)</summary><p>Press <strong>Install Phoenix</strong> above, then <strong>Install</strong>. Or open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p></details>
      <details><summary>iPhone and iPad (Safari)</summary><p>Open this page in <strong>Safari</strong> (not inside another app’s browser). Tap the <strong>Share</strong> button (a square with an arrow), scroll down and choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>. Open Phoenix from your Home Screen.</p></details>
      <details><summary>Mac Safari</summary><p>Choose <strong>File → Add to Dock</strong>.</p></details>
      <details><summary>Nothing happens, or there is no Install button?</summary><p>Phoenix may already be installed (look in your Start menu or Apps list). Private or incognito windows cannot install apps. Firefox on a computer cannot install web apps, so use Edge or Chrome. In the app, open <strong>Settings → Install as an app → Install not working? Check why</strong>.</p></details>
    </details>
  </section>
${donateStrip()}

  <h2>What Phoenix helps with</h2>
  <p>Phoenix is an AI assistant built around how many Autistic, ADHD and AuDHD people actually experience the world. It can help you make sense of <strong>autistic burnout</strong>, <strong>sensory overload</strong>, <strong>meltdowns and shutdowns</strong>, <strong>masking</strong>, low energy and the difficulty of getting started, and it offers practical, low-demand steps instead of advice to push harder.</p>
  <div class="grid">
    <div class="card"><h3>Neuro-affirming</h3><p>Built on the Six-Point Framework and other ideas from NeuroHub Community. It treats neurodivergence as difference, not deficit, and never tells you to mask more, comply, or “try harder”.</p></div>
    <div class="card"><h3>Daily check-in</h3><p>A two-minute wellbeing check-in across six areas of life, with charts that show how you are doing over time, gentle advice, and an optional daily reminder.</p></div>
    <div class="card"><h3>Floats beside your work</h3><p>Install Phoenix on a computer, press <strong>Float</strong>, then minimise it. A big animated Phoenix stays on top of your other windows with a speech bubble. Press <strong>Talk</strong> and have a spoken conversation, or type. Phoenix only floats while the app is minimised, and cannot see your screen unless you tell Phoenix.</p></div>
    <div class="card"><h3>Calming toolkit</h3><p>Breathing, grounding, sensory reset, a focus timer with company, a task breaker, scripts for hard messages and a personal support plan. All work with no AI and no internet.</p></div>
    <div class="card"><h3>Your own documents</h3><p>Fill in a burnout recovery plan, a six-area self-assessment or an identity workbook with Phoenix’s help, then download it as a PDF to keep or share.</p></div>
    <div class="card"><h3>Free AI, no setup</h3><p>Chat with Phoenix’s free Claude-powered AI straight away, or keep everything on your device with the built-in helper. <strong>Every reply costs NeuroHub money</strong>, so donations of any size, once or monthly, keep the AI live.</p></div>
    <div class="card"><h3>Accessibility built in</h3><p>Choose your font (including Lexend and OpenDyslexic), text size, line, letter and word spacing, colours, and the speech voice, speed and pitch. <a href="/accessibility/">See all accessibility features</a>.</p></div>
  </div>

  <h2>Your data stays yours</h2>
  <p>Phoenix needs no account, and stores your chats, check-ins and settings on your own device. If you want them to follow you between devices, and Phoenix to remember things about you, you can make a free optional account with just an email sign-in code. You can download a backup, restore one, or delete everything (including the account) from Settings. The built-in helper never sends anything anywhere. <a href="/privacy/">Read the plain-language privacy page</a>.</p>

  <h2>Safety</h2>
  <p>Phoenix is a computer program. It is not a therapist, doctor or crisis service, and it cannot diagnose. The red <strong>Help</strong> button is always visible and shows helplines and emergency numbers for your country. If you are in danger, call your local emergency number.</p>

  <h2 id="faq">Questions people ask</h2>
  <div class="faq">
${FAQ.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
  </div>

  <h2>Support NeuroHub Community</h2>
  <p>Phoenix is free to use because NeuroHub Community, a small Autistic-led social enterprise, pays for it, including the cost of every AI reply. If it has helped and you can spare something, you can <a href="#donate">give once or monthly</a>. There is never any pressure. To read more, visit <a href="https://neurohubcommunity.org">neurohubcommunity.org</a>, <a href="https://connect.neurohubcommunity.org/p/join">join the community</a>, or see <a href="https://mybook.to/dgh-full-catalogue">David Gray-Hammond’s books</a>.</p>`,
  });

  const privacy = layout({
    path: '/privacy/', title: 'Privacy: how Phoenix treats your data', description: 'Plain-language privacy for Phoenix, the free neuro-affirming AI assistant: chats and check-ins stay on your device unless you choose an optional account, no cookies.',
    crumbs: [{ name: 'Privacy', path: '/privacy/' }], jsonld: [ORG],
    body: `
  <h1>Privacy</h1>
  <p class="muted">In plain words. Last updated 30 September 2026.</p>
  <h2>What stays on your device</h2>
  <p>Your chats, daily check-ins, documents, tasks, settings are stored on your own device only, in the app or browser you use. NeuroHub Community cannot read or recover them. You can download a backup or delete everything at any time in Settings.</p>
  <h2>Voice and the microphone</h2>
  <p>Voice chat (talking to Phoenix with the microphone, spoken conversations and the wake word) is for people who have signed in to a free Phoenix account. Typing to Phoenix, and having a reply read aloud with its Read aloud button for accessibility, never need an account. Talking to Phoenix is optional and starts only when you press a microphone or Talk button, or, if you choose to turn it on in the installed app, when you say “Phoenix”. In Chrome and Edge the browser itself sends what the microphone hears to Google or Microsoft to turn it into text, while it is listening. With the “Phoenix” wake word that means the whole time it is switched on, not just after the name, so please do not use it where private conversations could be overheard. Phoenix does not record, keep or send audio, and the wake word is off until you turn it on. You can turn it off at any time.</p>
  <h2>Optional account and memories</h2>
  <p>You never need an account. If you make one (with an emailed sign-in code, no password), your chats, daily check-ins, documents, settings and the short notes Phoenix keeps about you are saved to it so they follow you between devices.</p>
  <ul>
    <li><strong>Your email address is never stored.</strong> It is used once to send the code. Only an unreadable fingerprint of it is kept, so nobody can see or recover your address from our records.</li>
    <li><strong>Your synced data is stored scrambled</strong> with a key only the server holds. NeuroHub staff do not read it, and it is not used for research, sharing or advertising.</li>
    <li><strong>You are in control of what Phoenix remembers.</strong> Every note can be seen, edited and deleted, notes can be switched off, and Phoenix never writes notes after a crisis conversation or keeps whole conversations as notes. When you chat, the notes go to Anthropic’s Claude with your message so Phoenix can use them, like the rest of the conversation.</li>
    <li><strong>You can download everything held, or delete your account</strong> and all its data at any time, in Settings. Deleting is permanent. The account is for people aged 18 and over.</li>
    <li>Anonymous counts (for example “an account was made”) are kept for running Phoenix. They contain nothing about you.</li>
  </ul>
  <h2>Suggestions of guides, courses and products</h2>
  <p>Phoenix can suggest things that might help, from the websites it has permission to use only (NeuroHub Community, and Helen Edgar’s Autistic Realms and More Realms). A list of what those sites offer, made from their public sitemap.xml files, is built into the app, and matching it to what you are asking about happens on your device. If you use Phoenix AI, a suggestion is sent along with your message like any other background material. Suggestions are occasional, never during a hard moment, labelled with the price, and can be switched off in Settings. NeuroHub and Helen Edgar make these things, so they are not independent recommendations.</p>
  <h2>Where Phoenix’s knowledge comes from</h2>
  <p>Phoenix’s reference material is the writing of NeuroHub Community and of Helen Edgar (the websites <a href="https://autisticrealms.com">Autistic Realms</a> and <a href="https://morerealms.com">More Realms</a>), used with Helen’s permission and credited by name where Phoenix uses it. That writing stays the property of its authors.</p>
  <h2>What the AI sees</h2>
  <ul>
    <li><strong>Built-in helper:</strong> nothing leaves your device.</li>
    <li><strong>Phoenix AI (limited), where new people start:</strong> your messages go to NeuroHub Community’s server, which passes them to Anthropic’s Claude to write a reply. They are not stored or logged by NeuroHub. Only anonymous counters are kept to enforce a daily limit. Your daily check-ins are not sent unless you allow it. You can opt out at any time in Settings by choosing the built-in helper.</li>
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
  <p>To learn how many people find and use Phoenix, NeuroHub counts visits to this website, clicks on Install and download, app opens and installs, which parts of the app get used (for example “a check-in was completed” or “the breathing tool was opened”, never what was written), how many AI replies are given and when limits are reached, and, for websites that add the Phoenix widget, the website’s address and how often the widget is opened. It stores only daily totals, plus a coarse device type (for example Android or Windows), a country code and the website that referred you. It uses no cookies and stores no IP address, no identifier, no message or health information. If your browser sends Do Not Track or Global Privacy Control, nothing is counted. In the app you can switch counting off in Settings, under Your data.</p>
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
  const thanks = layout({
    path: '/thanks/', title: 'Thank you for supporting Phoenix', description: 'Thank you for supporting NeuroHub Community and keeping Phoenix, the free neuro-affirming AI assistant, running.', noindex: true,
    body: `
  <h1>Thank you</h1>
  <p style="font-size:1.2rem">Your gift helps NeuroHub Community keep Phoenix free for everyone and pay for its AI. It really does make a difference.</p>
  <p>A receipt is on its way to your email. If you chose to give monthly, you can cancel at any time from the link in that receipt.</p>
  <p><a class="btn btn-primary" href="/app/">Back to Phoenix</a> <a class="btn" href="/">Home</a></p>`,
  });
  const embed = layout({
    path: '/add-to-your-site/', title: 'Add Phoenix to your website: free floating chat widget', description: 'Add Phoenix, the free neuro-affirming AI assistant, to your website with one line of code: a floating chat button that opens Phoenix in a panel. Free, accessible, no cookies.',
    crumbs: [{ name: 'Add Phoenix to your website', path: '/add-to-your-site/' }], jsonld: [ORG],
    body: `
  <h1>Add Phoenix to your website</h1>
  <p class="lead" style="font-size:1.15rem">Give your visitors a calm, neuro-affirming place to turn. One line of code adds <strong>Phoenix</strong> to your site: an animated character floating in the corner of every page, with the chat open beside Phoenix. Phoenix’s eyes follow the visitor’s pointer, Phoenix reacts to what they say, and visitors can drag Phoenix anywhere. It is free, there is nothing to sign up for, and it works on any website, including WordPress, Wix, Squarespace and Shopify.</p>
  <section class="card" aria-labelledby="snip-h">
    <h2 id="snip-h">1. Copy this line</h2>
    <p>Paste it just before the closing <code>&lt;/body&gt;</code> tag on every page where you want Phoenix (or into your site’s “custom code” or “footer scripts” setting).</p>
    <pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:3px solid var(--border,#1b1230);border-radius:12px;padding:.8rem"><code id="snippet">&lt;script src="${ORIGIN}/embed.js" async&gt;&lt;/script&gt;</code></pre>
    <p><button type="button" class="btn btn-primary" id="copy-snippet">Copy the code</button> <span id="copy-status" role="status" class="muted"></span></p>
  </section>
  <h2>How Phoenix behaves</h2>
  <ul>
    <li><strong>Always there, and never in the way.</strong> Phoenix floats in the bottom-right corner, animated, on every page, and starts minimised with a friendly greeting. A click on him opens a rounded chat box beside him (full-screen on a phone).</li>
    <li><strong>Visitors stay in control.</strong> Clicking Phoenix (or pressing Enter or Space when Phoenix is focused) minimises or reopens the chat, Escape minimises it, and Phoenix can be dragged anywhere. If a visitor minimises Phoenix, Phoenix stays minimised for the rest of their visit.</li>
    <li><strong>Phoenix is alive.</strong> Phoenix leans in while someone types, nods, takes on the feeling of what they say (calm for worry, soft for sadness, sparkles for good news), moves the beak while replying, and now and then stretches, preens or looks around. With reduced motion switched on Phoenix holds still poses instead.</li>
  </ul>
  <h2>2. Make it yours (optional)</h2>
  <p>Add any of these to the same line:</p>
  <ul>
    <li><code>data-position="left"</code>: put Phoenix bottom-left (default is bottom-right)</li>
    <li><code>data-size="160"</code>: how big Phoenix is, in pixels (90 to 220, default 130)</li>
    <li><code>data-open="false"</code> (the default: Phoenix starts minimised and a click opens the chat) or <code>"true"</code> (start with the chat open)</li>
    <li><code>data-greeting="Need a calm moment?"</code>: the bubble Phoenix shows while minimised (<code>""</code> for none)</li>
    <li><code>data-label="Chat with us"</code>, <code>data-color="#0f766e"</code>, <code>data-offset="30"</code>: the label read by screen readers, the chat’s header colour, and the distance from the edge</li>
    <li><code>data-style="button"</code>: use a round button instead of the floating character</li>
  </ul>
  <p>Example: <code>&lt;script src="${ORIGIN}/embed.js" data-position="left" data-greeting="Need a calm moment?" async&gt;&lt;/script&gt;</code></p>
  <p>You can also open or close Phoenix from your own button with <code>PhoenixWidget.open()</code> and <code>PhoenixWidget.close()</code>.</p>
  <h2>What visitors get</h2>
  <ul>
    <li>Phoenix chat (typed, and spoken where the browser allows it), the daily check-in, the calming toolkit and the Help button with helplines for their country, the same as the app.</li>
    <li>It can be used with a keyboard and a screen reader, and works on phones.</li>
    <li>Their chats stay on their own device, inside Phoenix’s own frame. <strong>Your website never sees what visitors type or what Phoenix says</strong>: the only thing passed to the page is a few fixed words that animate Phoenix (such as “thinking” or “calm”).</li>
  </ul>
  <h2>Privacy and cost</h2>
  <ul>
    <li>The widget sets no cookies. The only thing it stores is a note, for that visitor’s visit only, that they minimised Phoenix.</li>
    <li>NeuroHub Community counts, anonymously, that the widget loaded on your website’s address, how often the chat is opened, how many messages are sent, which features get used, and how many people click to donate, all as totals for your website, so we can see how it helps. We never see who your visitors are or what they write. Visitors who send Do Not Track are not counted.</li>
    <li>The AI replies are paid for by NeuroHub Community, and each visitor has a daily limit. If Phoenix is useful to your visitors, please consider <a href="/#donate">a donation</a> to keep it live.</li>
    <li>Phoenix is a computer program, not a therapist or a crisis service. Please say so on your site if you add Phoenix.</li>
  </ul>
  <p>Questions: <a href="https://neurohubcommunity.org/contact-us/">neurohubcommunity.org/contact-us</a>. You can try Phoenix right now: the Phoenix in the corner of this page is the widget.</p>
  <script>(function(){var b=document.getElementById('copy-snippet'),s=document.getElementById('snippet'),o=document.getElementById('copy-status');if(!b)return;b.addEventListener('click',function(){var t=s.textContent;var done=function(){o.textContent='Copied.';};var fail=function(){var r=document.createRange();r.selectNodeContents(s);var g=getSelection();g.removeAllRanges();g.addRange(r);o.textContent='Selected. Press Ctrl+C (or Cmd+C) to copy.';};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,fail);}else fail();});})();</script>
  <script src="/embed.js" data-open="false" data-greeting="Hi! I’m the widget. Press me to try the chat." async></script>`,
  });
  return { '/': home, '/privacy/': privacy, '/accessibility/': access, '/thanks/': thanks, '/add-to-your-site/': embed };
}
