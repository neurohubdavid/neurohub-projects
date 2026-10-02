# Phoenix Desktop

Phoenix, the free neuro-affirming AI assistant by NeuroHub Community, floating on your desktop like a desktop companion. He starts minimised in the corner of your screen; click him and a rounded chat opens beside him. Drag him anywhere. Press **Ctrl+Alt+P** (or click the tray icon) to open or close the chat from anywhere.

This program is only a see-through, click-through window. Phoenix himself (the character, the chat, the AI, accounts, safety) is the live site at <https://phoenix.neurohubcommunity.org/desktop/>, so he is always up to date and always connected to Phoenix AI. Nothing is stored by this program except one small settings file (whether to start with Windows).

## Run it

Unzip `Phoenix-Desktop-windows-arm64.zip` (or `-x64.zip` on an Intel/AMD PC) anywhere and run `Phoenix Desktop.exe`. Phoenix appears in the bottom-right corner, and an icon appears in the tray (the `^` by the clock) with: Talk to Phoenix, Hide, Move to the next screen, Start with Windows, Quit.

From source: `npm install`, then `node node_modules/electron/install.js` if Electron did not download, then `npm start`.

## What it can and cannot do

- Chat with Phoenix AI, accounts and memories, the toolkit, safety support and spoken replies (read aloud) all work, because it is the same app.
- Click-through: everywhere except Phoenix and the open chat lets clicks pass to the programs underneath.
- It cannot hear you. Electron has no speech recognition, so the microphone, "Talk" and the "Phoenix" wake word are not available here; use the installed Phoenix app in Edge or Chrome for those (it floats, too, via the Float button).
- No camera, microphone, location or notification permission is ever granted, and Phoenix cannot see your screen.
- Links open in your normal browser. The window can only ever show Phoenix's own site.

## Build

`npm run dist` writes unpacked Windows folders to `dist/` (zip them to share). They are not code-signed, so Windows SmartScreen may warn the first time; a code-signing certificate is the only fix.

## Test

`npm test` starts the real program against the live site and checks the window, click-through, opening the chat and the permissions.

MIT licence. The writing and artwork inside Phoenix belong to NeuroHub Community.
