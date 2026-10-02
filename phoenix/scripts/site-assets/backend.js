// The /backend/ page: one big Install button for the Phoenix backend app. The app itself lives at /admin/ (that is where its manifest and
// service worker are); this page only starts the installation, or sends you there to do it from the browser's own menu.
(function () {
  'use strict';
  var btn = document.getElementById('install'), note = document.getElementById('note'), copy = document.getElementById('copy');
  var ua = navigator.userAgent || '';
  var android = /Android/i.test(ua), windows = /Windows/i.test(ua), ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var deferred = null;
  var mark = function (id) { var b = document.querySelector('#' + id + ' .badge'); if (b) b.hidden = false; var c = document.getElementById(id); if (c) c.classList.add('me'); };
  if (android) mark('android'); else if (windows) mark('windows');

  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(function () { /* the browser menu still works */ });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; note.textContent = 'Ready to install.'; });
  window.addEventListener('appinstalled', function () { note.textContent = 'Installed. Open Phoenix from your Start menu or home screen.'; btn.hidden = true; });
  if (standalone) { btn.hidden = true; note.textContent = 'You are already using the app.'; }

  btn.addEventListener('click', function () {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { note.textContent = c && c.outcome === 'accepted' ? 'Installing…' : 'No problem. You can install it any time.'; deferred = null; }); return; }
    // the browser has not offered the prompt on this page: the app's own page can, or the browser menu always can
    if (ios) { note.textContent = 'On iPhone or iPad: open this in Safari, tap Share, then Add to Home Screen.'; return; }
    note.textContent = android ? 'Open the browser menu (⋮) and choose Install app.' : 'Opening the backend, where you can use the install icon in the address bar…';
    if (!android) setTimeout(function () { location.href = '/admin/?install=1'; }, 1200);
  });

  copy.addEventListener('click', function () {
    var url = location.origin + '/backend/';
    var done = function () { note.textContent = 'Link copied. Message it to your phone and open it there.'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { note.textContent = 'Copy this link: ' + url; });
    else note.textContent = 'Copy this link: ' + url;
  });
})();
