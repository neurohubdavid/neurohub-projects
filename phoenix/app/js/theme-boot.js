// Applies saved appearance and accessibility settings before first paint, so there is no flash of the wrong look.
// Keep the font stacks in step with FONTS in accessibility.js.
(function () {
  try {
    var s = (JSON.parse(localStorage.getItem('phoenix.v1') || '{}').prefs) || {};
    var r = document.documentElement;
    var stacks = {
      atkinson: ["'Atkinson Hyperlegible', system-ui, 'Segoe UI', Roboto, sans-serif", "'Lilita One', 'Atkinson Hyperlegible', system-ui, sans-serif"],
      lexend: ["'Lexend', system-ui, 'Segoe UI', sans-serif"],
      opendyslexic: ["'OpenDyslexic', 'Comic Sans MS', sans-serif"],
      system: ["system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"],
      serif: ["Georgia, 'Times New Roman', serif"],
      mono: ["ui-monospace, Consolas, 'Courier New', monospace"]
    };
    var f = stacks[s.font] || stacks.atkinson;
    if (s.theme && s.theme !== 'auto') r.dataset.theme = s.theme;
    if (s.motion && s.motion !== 'auto') r.dataset.motion = s.motion;
    if (s.textScale) r.style.setProperty('--scale', String(s.textScale));
    r.style.setProperty('--font', f[0]);
    r.style.setProperty('--display', f[1] || f[0]);
    if (s.lineHeight) r.style.setProperty('--lh', String(s.lineHeight));
    r.style.setProperty('--ls', (s.letterSpacing || 0) + 'em');
    r.style.setProperty('--ws', (s.wordSpacing || 0) + 'em');
    if (s.underlineLinks) r.dataset.links = 'underline';
    if (s.bigFocus) r.dataset.focus = 'big';
    if (s.narrow) r.dataset.measure = 'narrow';
    if (s.boldText) r.dataset.boldtext = 'on';
  } catch (e) { /* storage blocked: defaults */ }
})();
