// One-tap install on the front page. Where the browser can install Phoenix, the big button does it right here.
// iPhone and iPad have no install prompt, so the three steps are shown on the page instead. Where nothing can install
// (for example Firefox on a computer) it says so plainly. Without JavaScript the button is a normal link to the app.
(function () {
  var btn = document.getElementById('install-now'), help = document.getElementById('install-help');
  if (!btn || !help) return;
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var safari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);
  var firefoxDesktop = /firefox/i.test(ua) && !/android/i.test(ua) && !ios;
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var deferred = null;
  var say = function (html) { help.innerHTML = html; };

  function iosSteps() {
    if (!safari) return say('<p><strong>Open this page in Safari to install.</strong> On iPhone and iPad, only Safari can add Phoenix to your Home Screen. Copy this address, open Safari, and paste it in.</p>');
    say('<p><strong>To install on iPhone or iPad:</strong></p><ol><li>Tap the <strong>Share</strong> button (a square with an arrow) at the bottom or top of Safari.</li><li>Scroll down and tap <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong>. Phoenix now sits with your other apps.</li></ol>');
  }
  if (standalone) { btn.textContent = 'Open Phoenix'; btn.setAttribute('href', '/app/'); say('<p>You are already using Phoenix as an app.</p>'); return; }
  if (ios) { btn.textContent = safari ? 'Show me how to install' : 'Install on iPhone or iPad'; iosSteps(); }
  if (firefoxDesktop) say('<p>Firefox on a computer cannot install web apps. Open this page in <strong>Edge</strong> or <strong>Chrome</strong> to install Phoenix, or just use it in the browser.</p>');

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; });
  window.addEventListener('appinstalled', function () { deferred = null; btn.textContent = 'Open Phoenix'; btn.setAttribute('href', '/app/'); say('<p><strong>Phoenix is installed.</strong> Find it with your other apps.</p>'); });
  btn.addEventListener('click', function (ev) {
    if (deferred) {
      ev.preventDefault();
      var d = deferred; deferred = null; d.prompt();
      if (d.userChoice) d.userChoice.then(function (r) { if (r && r.outcome === 'dismissed') say('<p>No problem. You can install any time, or use Phoenix in the browser.</p>'); });
    } else if (ios) { ev.preventDefault(); iosSteps(); help.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    // otherwise the link opens the app, which offers the install straight away
  });
})();
