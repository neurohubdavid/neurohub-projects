# Phoenix: a neuro-affirming AI assistant

A free, private assistant for Autistic, ADHD and other neurodivergent people, from NeuroHub Community. It runs as a
desktop app (Windows installer or portable), and the same code also runs in any browser.

- **Bring your own AI.** Free and private on your own computer (Ollama or LM Studio), a free online tier (Google
  Gemini, Groq, OpenRouter, or any OpenAI-compatible service), or your own paid Anthropic key.
- **You pay your own tokens.** With an online key, messages are billed to *your* account with the provider. Phoenix and
  NeuroHub take no cut and see nothing. Phoenix shows a rough local usage and cost estimate and can enforce a daily
  message cap you set.
- **Works with no AI at all.** A built-in helper answers from a knowledge base drawn from David Gray-Hammond's books,
  and the Toolkit (breathing, grounding, sensory reset, energy check-ins, focus timer, task breaker, scripts, support
  plan) needs no internet.
- **Knows neurohubcommunity.org.** A snapshot of the site's public articles and pages is bundled. The assistant draws on
  the relevant ones (and links them), and Settings can refresh it live.
- **Private by design.** No account, no server, no analytics. Chats, check-ins and settings stay in the app's local
  storage on your device.
- **Safety runs in the app, not the model.** The Help button and crisis detection never depend on any AI. Helplines
  come from `app/data/crisis.json`.

## Guardrails (they do not depend on the AI model)

A real test against a small local model (Llama 3.2 1B) showed it invents medical claims, quotes outdated or foreign
hotline numbers, and makes up article titles. So `app/js/guard.js` handles those cases itself, whatever AI is connected:

- Questions about stopping, skipping or changing medicine get a vetted answer (talk to your prescriber, never stop
  suddenly, how to raise side effects). The model is never asked.
- "What has NeuroHub written about…?" is answered with the real articles from the bundled site snapshot.
- In a crisis the model's reply is held back and checked. If it contains any phone number or link that is not in the
  vetted list for the person's country, quotes an outdated service, or refuses coldly, it is replaced with a safe reply.

Recommend 3B models at minimum and 7 to 8B for good conversation. Run `node test/real-model.mjs <model>` to see how a
model behaves on the hard cases.

## Run it

```
npm install
npm start            # desktop app
npm run web          # browser version at http://localhost:5178
npm test             # unit tests
node test/e2e.mjs    # drives the real desktop app end to end (screenshots in test/shots)
```

## Build the downloads

```
npm run dist         # refreshes the site snapshot, then builds dist/Phoenix-Setup-<v>.exe and Phoenix-Portable-<v>.exe
```

Unsigned builds show a Windows SmartScreen warning ("More info", then "Run anyway"). Sign the installer with a code
signing certificate to remove it.

## Keeping it current

- `npm run sync-site` re-downloads neurohubcommunity.org into `app/data/site.json`.
- Knowledge lives in `app/js/kb.js` and `app/js/kb-books.js`. Values and voice live in `app/js/persona.js`.
- **Before release, verify every helpline in `app/data/crisis.json` against each provider's own website**, fill in
  `lastReviewed`, and re-check every few months.

## Notes

- Voice *output* works everywhere. Voice *input* uses the browser's speech service, which the desktop app does not have,
  so there the app suggests Windows dictation (Win + H). It works in Chrome, Edge and Safari in the web version.
- The assistant never advises starting, stopping or changing medication, never gives doses, and treats views such as
  "acquired neurodivergence" as the authors' and community's positions, not settled fact.
- API keys are stored on the device in plain text. Use keys with spending limits.
- Mascot artwork, books and site content belong to David Gray-Hammond / NeuroHub Community. Code is MIT licensed.
