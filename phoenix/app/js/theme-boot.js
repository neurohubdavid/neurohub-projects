// Applies saved appearance settings before first paint, so there is no flash of the wrong theme or text size.
(function () {
  try {
    const s = JSON.parse(localStorage.getItem('phoenix.v1') || '{}').prefs || {};
    const r = document.documentElement;
    if (s.theme && s.theme !== 'auto') r.dataset.theme = s.theme;
    if (s.motion && s.motion !== 'auto') r.dataset.motion = s.motion;
    if (s.textScale) r.style.setProperty('--scale', String(s.textScale));
    if (s.dyslexiaFont) r.dataset.dyslexia = 'on';
  } catch (e) { /* storage blocked: defaults */ }
})();
