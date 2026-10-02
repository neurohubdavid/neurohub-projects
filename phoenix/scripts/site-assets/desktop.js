// The Phoenix desktop program loads /desktop/ in a see-through window the size of the screen. This script lets clicks pass through
// everywhere except on Phoenix and the chat, and lets the program's shortcut and tray open and close the chat.
// In an ordinary browser tab there is no desktop program, so this only shows a short note.
(function () {
  'use strict';
  var api = window.phoenixDesktop; // put there by the desktop program's own small preload script, nowhere else
  if (!api) {
    var d = document.createElement('div'); d.className = 'hint';
    d.textContent = 'This is the page the Phoenix desktop program shows. In a browser you can use Phoenix at /app/, or add the widget to a website.';
    document.body.appendChild(d); return;
  }
  var last = null;
  function interactive(v) { if (v !== last) { last = v; api.setInteractive(v); } }
  interactive(false);
  // While the window ignores the mouse it still tells us where the pointer is, so we know when it is over Phoenix or the chat
  document.addEventListener('mousemove', function (e) {
    var t = e.target; interactive(!!(t && t.hasAttribute && t.hasAttribute('data-phoenix-widget')));
  }, true);
  document.addEventListener('mouseleave', function () { interactive(false); });
  api.onToggle(function () { if (window.PhoenixWidget) window.PhoenixWidget.toggle(); });
  api.onOpen(function () { if (window.PhoenixWidget) window.PhoenixWidget.open(); });
  // one anonymous count that the desktop program was started (nothing else), unless Do Not Track is on
  try {
    var dnt = navigator.doNotTrack === '1' || navigator.globalPrivacyControl;
    if (!dnt && navigator.sendBeacon) navigator.sendBeacon('/api/hit', new Blob([JSON.stringify({ e: 'feature', v: 'desktop_app_open' })], { type: 'text/plain' }));
  } catch (x) { /* counting must never get in the way */ }
})();
