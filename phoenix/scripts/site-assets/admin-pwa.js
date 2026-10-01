// Lets the private backend be installed as an app on a phone or computer (it is not a separate program: it is this same page, with
// its own icon and window). Nothing here caches any data: the app only ever shows what the server sends to a signed-in Admin.
(function () {
  var bar = document.getElementById('install-admin'), btn = document.getElementById('install-admin-btn'), help = document.getElementById('install-admin-help');
  if (!bar) return;
  var ua = navigator.userAgent || '';
  var standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) { bar.hidden = true; return; }
  var ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) navigator.serviceWorker.register('sw.js', { scope: './' }).catch(function () { /* the app can still be added from the browser menu */ });
  bar.hidden = false;
  if (ios) { btn.hidden = true; help.textContent = 'On iPhone or iPad, open this page in Safari, tap the Share button (a square with an arrow), then choose Add to Home Screen.'; }
  else help.textContent = 'Install it to get its own icon and a full-screen window. You still sign in with your password and authenticator code.';
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; btn.hidden = false; });
  window.addEventListener('appinstalled', function () { bar.hidden = true; });
  btn.addEventListener('click', function () {
    if (!deferred) { help.textContent = 'Use your browser menu: on Android Chrome choose Install app (or Add to Home screen); in Edge or Chrome on a computer use the install icon in the address bar.'; return; }
    deferred.prompt(); deferred.userChoice.then(function () { deferred = null; });
  });
})();
