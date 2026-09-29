// Anonymous, cookieless page counts for NeuroHub (see /privacy/). Sends a page view and Install clicks to /api/hit.
// Sends nothing at all if the browser says Do Not Track or Global Privacy Control, or on localhost.
(function () {
  try {
    if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl || /^(localhost|127\.)/.test(location.hostname) || navigator.webdriver) return;
    function send(e, v, r) {
      var body = JSON.stringify({ e: e, v: v, r: r || '' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/hit', new Blob([body], { type: 'application/json' }));
      else fetch('/api/hit', { method: 'POST', body: body, keepalive: true });
    }
    var path = location.pathname.replace(/index\.html$/, ''); if (path.slice(-1) !== '/') path += '/';
    var ref = ''; try { ref = new URL(document.referrer).hostname; } catch (x) { /* no referrer */ }
    send('view', path, ref);
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a[href*="install=1"]');
      if (a) send('install_click', 'landing');
      var d = ev.target.closest && ev.target.closest('a[data-amount]');
      if (d) send('donate_click', d.getAttribute('data-amount'));
    });
  } catch (e) { /* counting must never break the page */ }
})();
