# Phoenix Desktop

Phoenix, the free neuro-affirming AI assistant by NeuroHub Community, floating on your desktop like a desktop companion. He starts minimised in the corner of your screen; click him and a rounded chat opens beside him. Drag him anywhere. Press **Ctrl+Alt+P** (or click the tray icon) to open or close the chat from anywhere. You can **talk to him out loud** and, if you turn it on, **say “Phoenix”** to start a spoken conversation.

This program is a see-through, click-through window plus an offline speech engine. Phoenix himself (the character, the chat, the AI, accounts, safety) is the live site at <https://phoenix.neurohubcommunity.org/desktop/>, so he is always up to date and always connected to Phoenix AI.

## Run it

Unzip `Phoenix-Desktop-windows-arm64.zip` (or `-x64.zip` on an Intel/AMD PC) anywhere and run `Phoenix Desktop.exe`. Phoenix appears in the bottom-right corner, and an icon appears in the tray (the `^` by the clock) with: Talk to Phoenix, Hide, Move to the next screen, **Let Phoenix use the microphone**, Start with Windows, Quit.

From source: `npm install`, then `node node_modules/electron/install.js` if Electron did not download, then `npm run setup` (fetches the speech engine and its 40 MB model), then `npm start`.

## Talking and the wake word

- Voice chat, the microphone button, spoken conversations and the “Phoenix” wake word are for people with a free Phoenix account (sign in inside the chat, with an emailed code). The wake word is off until you turn it on in Settings, after a plain explanation.
- **Listening happens on your computer.** The browser’s own speech recognition needs Google’s servers and does not work in this program, so Phoenix uses [Vosk](https://alphacephei.com/vosk/), an open speech engine, offline. What the microphone hears is turned into text here and never sent anywhere; only the words go to Phoenix, like a typed message. Phoenix keeps no audio.
- The microphone is only used while Phoenix is listening. The tray menu shows when it is in use, and **Let Phoenix use the microphone** switches it off for good (Phoenix then says so and stops listening).
- Honest limits: it is a small, English (US) model. It copes best with clear speech, a decent microphone and a quiet room, and will sometimes mishear, especially names and unusual words. You can always type instead, or use the installed Phoenix app in Edge or Chrome, whose cloud speech recognition is more accurate (but sends your speech to Google or Microsoft). The engine uses a few hundred MB of memory while loaded and is let go of after a few quiet minutes. The first time it listens it takes a few seconds to get ready.
- Phoenix reads replies aloud with your computer’s own voices (Settings, Read replies aloud).

## What it can and cannot do

- Everything in Phoenix works: chat with Phoenix AI, accounts and memories, the toolkit and safety support.
- Click-through: everywhere except Phoenix and the open chat lets clicks pass to the programs underneath.
- Phoenix cannot see your screen. No camera, location or notification permission is ever granted, and the web page itself can never open the microphone (only the program’s hidden speech window can, for Phoenix’s own chat).
- Links open in your normal browser. The window can only ever show Phoenix’s own site.

## Build

`npm run dist` writes unpacked Windows folders to `dist/` (zip them to share). They are not code-signed, so Windows SmartScreen may warn the first time; a code-signing certificate is the only fix.

## Test

- `npm test` starts the real program against the live site: the window, click-through, opening the chat, the permissions, and listening (a recorded voice saying “Phoenix. I feel a bit overwhelmed today.” stands in for the microphone, through `PHOENIX_FAKE_MIC`, a test-only switch).
- `node test/packaged.js` does the speech check on the packaged build in `dist/`.
- The recording was made with Windows’ own voice; to remake it see `test/audio/`.

MIT licence (see `THIRD-PARTY-NOTICES.md` for Electron and Vosk). The writing and artwork inside Phoenix belong to NeuroHub Community.
