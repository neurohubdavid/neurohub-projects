/* Phoenix floating chat widget by NeuroHub Community.
 * Add to any website:  <script src="https://phoenix.neurohubcommunity.org/embed.js" async></script>
 * Optional settings on the script tag:
 *   data-position="left" | "right" (default right)    data-label="Chat with Phoenix"    data-color="#7C3AED"
 *   data-open="true" (open when the page loads)         data-offset="20" (pixels from the edge)
 * It adds one round button. Press it and Phoenix opens in a panel (the same app as phoenix.neurohubcommunity.org/app/).
 * Privacy: no cookies and nothing is written to your page or visitors' devices until the button is pressed. It counts, anonymously,
 * that the widget was loaded on your website's address, and that it was opened or used, in NeuroHub's private statistics. Visitors who
 * send Do Not Track or Global Privacy Control are not counted. */
(function () {
  'use strict';
  if (window.__phoenixWidget) return;
  window.__phoenixWidget = true;
  var HOME = 'https://phoenix.neurohubcommunity.org';
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var origin = HOME;
  try { origin = new URL(script.src).origin; } catch (e) { /* use the default */ } // the app is loaded from wherever this script was served from
  var attr = function (n, d) { var v = script && script.getAttribute('data-' + n); return v == null || v === '' ? d : v; };
  var left = attr('position', 'right') === 'left';
  var label = attr('label', 'Chat with Phoenix').slice(0, 60);
  var color = /^#[0-9a-f]{3,8}$/i.test(attr('color', '')) ? attr('color', '') : '#7C3AED';
  var offset = Math.max(0, Math.min(80, parseInt(attr('offset', '20'), 10) || 20));
  var host = location.hostname;

  var dnt = navigator.doNotTrack === '1' || navigator.globalPrivacyControl || window.doNotTrack === '1';
  function count(e) {
    try {
      if (dnt || navigator.webdriver || /^(localhost|127\.)/.test(host)) return;
      var body = JSON.stringify({ e: e, v: 'ok', h: host });
      if (navigator.sendBeacon) navigator.sendBeacon(origin + '/api/hit', new Blob([body], { type: 'text/plain' }));
    } catch (x) { /* counting must never break your page */ }
  }

  function build() {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-phoenix-widget', '');
    wrap.style.cssText = 'all:initial;position:fixed;z-index:2147483000;bottom:' + offset + 'px;' + (left ? 'left' : 'right') + ':' + offset + 'px;';
    var root = wrap.attachShadow ? wrap.attachShadow({ mode: 'open' }) : wrap;
    var css = document.createElement('style');
    css.textContent =
      '*{box-sizing:border-box}' +
      '.fab{display:flex;align-items:center;gap:.5rem;border:3px solid #1b1230;background:' + color + ';color:#fff;border-radius:999px;padding:.35rem .9rem .35rem .35rem;font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:3px 3px 0 #1b1230}' +
      '.fab:hover{transform:translate(-1px,-1px);box-shadow:4px 4px 0 #1b1230}.fab:focus-visible,.x:focus-visible,.full:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px #1b1230}' +
      '.fab img{width:42px;height:42px;border-radius:50%;background:#fff;border:2px solid #1b1230}' +
      '.panel{display:none;position:absolute;bottom:0;' + (left ? 'left' : 'right') + ':0;width:min(400px,calc(100vw - ' + (offset * 2) + 'px));height:min(640px,calc(100vh - ' + (offset * 2) + 'px));background:#fff;border:3px solid #1b1230;border-radius:18px;box-shadow:5px 5px 0 #1b1230;overflow:hidden;flex-direction:column}' +
      '.open .panel{display:flex}.open .fab{display:none}' +
      '.bar{display:flex;justify-content:space-between;align-items:center;gap:.5rem;background:' + color + ';color:#fff;padding:.4rem .6rem;font:600 14px system-ui,sans-serif}' +
      '.x,.full{background:#fff;color:#1b1230;border:2px solid #1b1230;border-radius:8px;padding:.25rem .6rem;font:600 13px system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
      'iframe{flex:1;border:0;width:100%;background:#fff}' +
      '@media (max-width:520px){.panel{position:fixed;inset:0;width:100vw;height:100dvh;border-radius:0;border:0;box-shadow:none}}' +
      '@media (prefers-reduced-motion:no-preference){.fab{transition:transform .12s}}';
    var box = document.createElement('div');
    var fab = document.createElement('button');
    fab.type = 'button'; fab.className = 'fab'; fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
    var img = document.createElement('img'); img.src = origin + '/assets/icon-192.png'; img.alt = ''; img.width = 42; img.height = 42;
    var txt = document.createElement('span'); txt.textContent = label;
    fab.append(img, txt);
    var panel = document.createElement('div'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Phoenix, a neuro-affirming AI assistant');
    var bar = document.createElement('div'); bar.className = 'bar';
    var title = document.createElement('span'); title.textContent = 'Phoenix by NeuroHub Community';
    var right = document.createElement('span'); right.style.cssText = 'display:flex;gap:.4rem';
    var full = document.createElement('a'); full.className = 'full'; full.href = origin + '/app/'; full.target = '_blank'; full.rel = 'noopener'; full.textContent = 'Open full app';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'x'; close.textContent = 'Close'; close.setAttribute('aria-label', 'Close Phoenix');
    right.append(full, close); bar.append(title, right);
    var frame = null;
    panel.append(bar);
    box.append(fab, panel);
    root.append(css, box);

    function open() {
      if (!frame) { // the app is only loaded the first time someone asks for it
        frame = document.createElement('iframe');
        frame.title = 'Phoenix chat';
        frame.setAttribute('allow', 'clipboard-write; microphone');
        frame.src = origin + '/embed/?h=' + encodeURIComponent(host);
        panel.append(frame);
      }
      box.className = 'open'; fab.setAttribute('aria-expanded', 'true');
      setTimeout(function () { try { frame.focus(); } catch (e) { close.focus(); } }, 50);
    }
    function shut() { box.className = ''; fab.setAttribute('aria-expanded', 'false'); fab.focus(); }
    fab.addEventListener('click', open);
    close.addEventListener('click', shut);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && box.className === 'open') shut(); });
    window.addEventListener('message', function (ev) { // Escape pressed inside Phoenix (keys do not reach this page from inside the panel)
      if (ev.origin === origin && ev.data && ev.data.phoenix === 'close' && box.className === 'open') shut();
    });
    document.body.appendChild(wrap);
    window.PhoenixWidget = { open: open, close: shut };
    if (attr('open', '') === 'true') open();
    count('embed_load');
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
