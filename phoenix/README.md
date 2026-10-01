# Phoenix: a neuro-affirming AI assistant

A free, private assistant for Autistic, ADHD and other neurodivergent people, from NeuroHub Community. Phoenix is a web
app (no build step) that people install as an app on any device (a PWA) from https://phoenix.neurohubcommunity.org, and
that can float beside their work on a computer. There is no separate desktop program.

- **Phoenix AI.** Replies are written by NeuroHub's own Claude account, reached through a small server function
  (`netlify/functions/ai.mjs`). The key lives only in the `PHOENIX_ANTHROPIC_KEY` environment variable on the server and is
  never in the app. Daily limits per person and overall keep the cost bounded, and donations (Stripe, once or monthly)
  pay for it. Nobody connects their own AI or key.
- **Works with no AI at all.** A built-in helper answers from a knowledge base drawn from David Gray-Hammond's books, and
  the Toolkit (breathing, grounding, sensory reset, energy check-ins, focus timer, task breaker, scripts, support plan)
  needs no internet.
- **Floating Phoenix** (`app/js/float.js`). In Edge or Chrome on a computer, the Float button opens a small always-on-top
  Document Picture-in-Picture window with the animated Phoenix and the same chat. It stays while the main window is
  minimised and closes when the person comes back. Browsers only open it when a button is pressed, and Phoenix cannot see
  the screen, so the person tells her what they are doing.
- **Website widget** (`scripts/site-assets/embed.js`, served at `/embed.js`; the panel is `/embed/`). One script tag puts a
  floating Phoenix button on any website. See `/add-to-your-site/`.
- **Knows neurohubcommunity.org.** A snapshot of the site's public articles and pages is bundled.
- **Private by design.** No account. Chats, check-ins and settings stay in the browser's storage on the device. Anonymous,
  cookieless counts (`netlify/functions/hit.mjs`) feed a private Admin-only backend (`/admin/`).
- **Safety runs in the app, not the model.** The Help button and crisis detection never depend on any AI. Helplines come
  from `app/data/crisis.json`.

## Guardrails (they do not depend on the AI model)

`app/js/guard.js` handles the cases models get wrong, whatever AI answers:

- Questions about stopping, skipping or changing medicine get a vetted answer. The model is never asked.
- "What has NeuroHub written about…?" is answered with the real articles from the bundled site snapshot.
- In a crisis the model's reply is held back and checked. A reply with a phone number or link that is not in the vetted
  list for the person's country, or that refuses coldly, is replaced with a safe reply.

## Run it

```
npm install
npm run web          # the app at http://localhost:5178/app/
npm test             # unit tests
node test/e2e.mjs    # drives the app in Microsoft Edge end to end (screenshots in test/shots)
node test/float.mjs  # floating window
node test/widget.mjs # website widget
node test/pwa.mjs; node test/landing.mjs; node test/web-smoke.mjs; node test/admin-ui.mjs
```

## Build and deploy the website

```
node scripts/build-site.mjs
netlify deploy --prod --dir site --functions netlify/functions --site <site id> --skip-functions-cache
```

The site is built into `./site`: the landing pages, the app under `/app/`, the widget at `/embed.js` and `/embed/`.
Set these Netlify environment variables: `PHOENIX_ANTHROPIC_KEY` (secret), `ADMIN_USERS` and `ADMIN_SESSION_SECRET`
(see `scripts/admin-setup.mjs`). Optional: `PHOENIX_PER_PERSON_DAILY`, `PHOENIX_GLOBAL_DAILY`, `PHOENIX_GLOBAL_MONTHLY`,
`PHOENIX_MODEL`, `PHOENIX_SHARED_AI=off`.

## Keeping it current

- `npm run sync-site` re-downloads neurohubcommunity.org into `app/data/site.json`.
- Knowledge lives in `app/js/kb.js` and `app/js/kb-books.js`. Values and voice live in `app/js/persona.js`.
- **Before release, verify every helpline in `app/data/crisis.json` against each provider's own website**, fill in
  `lastReviewed`, and re-check every few months.
- Donation links live in `app/js/donate-links.js` (Stripe Payment Links).

## Daily check-in (6PF-Wellness)

The **Check-in** tab is a two-minute daily check-in using the same six domains and 1–5 scale as NeuroHub's client portal (sensory, daily living, social, emotional, identity, strengths), plus a "one thing I'll protect today" prompt.

- **Insights**: 7/30/90-day and all-time views, a line chart you can toggle by area, area averages with change against the previous period, best and hardest weekdays, a calendar heat map, streaks, and your own notes. Every chart has a text description and a table alternative, and uses dash patterns as well as colour.
- **Advice** is built in and works offline (`app/js/sixpf.js`, unit tested): it describes patterns cautiously, never diagnoses, and links to Toolkit tools and Learn topics. Very low days show the Help button first. Only if the person allows it in Settings can Phoenix AI read a short summary and discuss the patterns in chat.
- **Reminders** (Settings → Daily check-in): the installed app uses notifications (and periodic background sync where the browser allows it), and any device can add a repeating daily `.ics` calendar event. One reminder a day at most, skipped if you have already checked in.
- Check-ins stay on the device and can be exported as a summary or CSV.

## Knowledge sources

`app/data/site.json` (neurohubcommunity.org, `npm run sync-site`), `app/data/presentations.json` (training decks via `scripts/build-presentations.mjs`, then recorded conversations via `scripts/build-transcripts.mjs`), and the curated entries in `app/js/kb*.js`. Leave a deck or transcript out with `scripts/presentations-exclude.json` / `scripts/transcripts-exclude.json`. Check that everything you bundle is something you are happy to publish: the app and its data are public once deployed.

## Notes

- Voice *output* works everywhere. Voice *input* uses the browser's speech service (Chrome, Edge and Safari).
- The assistant never advises starting, stopping or changing medication, never gives doses, and treats views such as
  "acquired neurodivergence" as the authors' and community's positions, not settled fact.
- Mascot artwork, books and site content belong to David Gray-Hammond / NeuroHub Community. Code is MIT licensed.

## Documents (PDF) and donations

**Documents** (Check-in tab): NeuroHub's practitioner documents, read straight from `neurohub-practitioner-app` by `scripts/build-assessments.mjs` into `app/data/assessments.json`: the 6PF Global Assessment (six areas, 1 to 10 ratings), the Burnout Recovery Plan and the Positive Autistic Identity workbook. Staff-only parts are dropped. A person fills them in one section at a time; Phoenix AI can draft answers from the person's own messages (never its own replies, never ratings, never overwriting their words, drafts flagged until checked, consent shown first). `app/js/pdf.js` makes a real A4 PDF on the device with pdf-lib (bundled in `app/vendor`).

**Donate**: the header button opens suggested amounts of £5, £10, £25 and £50, once or monthly, or an amount of the person's choosing (`app/js/donate.js`, `app/js/donate-links.js`). Each opens a Stripe-hosted payment page, so no payment detail ever touches Phoenix.

## Privacy of people in the knowledge

Names and personal details of private individuals are kept out of everything Phoenix can read or repeat (`scripts/privacy.mjs`, used by both build scripts, enforced by a unit test). Ideas, research citations, published-book credits and NeuroHub itself stay. Speakers, guests, colleagues, family and community members, places tied to people's lives, credentials, and any first-person account are dropped sentence by sentence, and deck titles carry no names. Phoenix's instructions also tell it never to reveal such details, and it points to the ideas instead.

## Licence

The code is MIT licensed. The written content (knowledge, documents, training text) belongs to NeuroHub Community Ltd and is not MIT licensed: see [CONTENT-NOTICE.md](CONTENT-NOTICE.md).
