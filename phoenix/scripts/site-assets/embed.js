/* Phoenix, a free-floating animated assistant for your website, by NeuroHub Community.
 * Add to any website:  <script src="https://phoenix.neurohubcommunity.org/embed.js" async></script>
 * What visitors see: Phoenix, an animated character floating in a corner of the page. Her eyes follow the pointer, she reacts to the
 * conversation, and the chat is open beside her (on phones she waits with a greeting until tapped). Visitors can drag her anywhere,
 * click her to minimise or reopen the chat, and press Escape to minimise.
 * Optional settings on the script tag:
 *   data-position="left" | "right" (default right)     data-size="130"  (her size in pixels, 90 to 220)
 *   data-open="false" (default: Phoenix starts minimised, and a click opens the chat) | "true" (start with the chat open)
 *   data-greeting="Hi! Want to talk?" (the bubble shown while she is minimised, or "" for none)
 *   data-label="Chat with Phoenix"   data-color="#7C3AED"   data-offset="20"
 *   data-style="button"  (use a round button instead of the floating character)
 * Privacy: no cookies. If a visitor minimises Phoenix, the page remembers that for their visit only (session storage), nothing more.
 * Phoenix runs in frames from phoenix.neurohubcommunity.org: your website never sees what visitors type or what Phoenix says. NeuroHub
 * counts, anonymously, that the widget loaded on your website, how it is used and how many people click to donate, as totals for your
 * website. Visitors who send Do Not Track or Global Privacy Control are not counted. */
(function () {
  'use strict';
  if (window.__phoenixWidget) return;
  window.__phoenixWidget = true;
  var HOME = 'https://phoenix.neurohubcommunity.org';
  var script = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  var origin = HOME;
  try { origin = new URL(script.src).origin; } catch (e) { /* use the default */ } // everything is loaded from wherever this script was served from
  var attr = function (n, d) { var v = script && script.getAttribute('data-' + n); return v == null ? d : v; };
  var left = attr('position', 'right') === 'left';
  var label = (attr('label', '') || 'Chat with Phoenix').slice(0, 60);
  var color = /^#[0-9a-f]{3,8}$/i.test(attr('color', '')) ? attr('color', '') : '#7C3AED';
  var offset = Math.max(0, Math.min(80, parseInt(attr('offset', '20'), 10) || 20));
  var size = Math.max(90, Math.min(220, parseInt(attr('size', '130'), 10) || 130));
  var asButton = attr('style', 'character') === 'button';
  var greeting = attr('greeting', 'Hi, I’m Phoenix. Want to talk?').slice(0, 80);
  var openMode = attr('open', 'false'); // Phoenix starts minimised; a click on him opens the chat
  var host = location.hostname;
  var KEY = 'phoenix-widget';
  var phone = function () { return Math.min(window.innerWidth, window.innerHeight) < 600 || window.innerWidth < 700; };

  var dnt = navigator.doNotTrack === '1' || navigator.globalPrivacyControl || window.doNotTrack === '1';
  function count(e) {
    try {
      if (dnt || navigator.webdriver || /^(localhost|127\.)/.test(host)) return;
      var body = JSON.stringify({ e: e, v: 'ok', h: host });
      if (navigator.sendBeacon) navigator.sendBeacon(origin + '/api/hit', new Blob([body], { type: 'text/plain' }));
    } catch (x) { /* counting must never break your page */ }
  }
  var remembered = function () { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } };
  var remember = function (v) { try { sessionStorage.setItem(KEY, v); } catch (e) { /* fine */ } };

  function build() {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-phoenix-widget', '');
    wrap.style.cssText = 'all:initial;position:fixed;z-index:2147483000;bottom:' + offset + 'px;' + (left ? 'left' : 'right') + ':' + offset + 'px;pointer-events:none;';
    var root = wrap.attachShadow ? wrap.attachShadow({ mode: 'open' }) : wrap;
    var css = document.createElement('style');
    var charH = Math.round(size * 1.08);
    css.textContent =
      '*{box-sizing:border-box}' +
      '.dock{display:flex;align-items:flex-end;gap:10px;flex-direction:' + (left ? 'row-reverse' : 'row') + '}' +
      '.dock>*{pointer-events:auto}' +
      '.char{position:relative;width:' + size + 'px;height:' + charH + 'px;flex:none}' +
      '.char iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;color-scheme:normal;pointer-events:none}' +
      '.hit{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;cursor:grab;border-radius:24px;padding:0;touch-action:none;-webkit-tap-highlight-color:transparent}' +
      '.hit.dragging{cursor:grabbing}.hit:focus-visible{outline:3px solid ' + color + ';outline-offset:2px}' +
      '.bubble{position:absolute;bottom:' + (charH - 6) + 'px;' + (left ? 'left' : 'right') + ':' + Math.round(size * 0.1) + 'px;max-width:230px;width:max-content;background:#fff;color:#1b1230;border:3px solid #1b1230;border-radius:16px;padding:.5rem .75rem;font:600 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:3px 3px 0 #1b1230;cursor:pointer;opacity:0;transform:translateY(6px) scale(.96);transition:opacity .25s,transform .25s;pointer-events:none}' +
      '.bubble.show{opacity:1;transform:none;pointer-events:auto}' +
      '.bubble:after{content:"";position:absolute;bottom:-11px;' + (left ? 'left' : 'right') + ':22px;width:16px;height:16px;background:#fff;border-right:3px solid #1b1230;border-bottom:3px solid #1b1230;transform:rotate(45deg)}' +
      '.panel{display:none;position:relative;flex-direction:column;width:min(390px,calc(100vw - ' + (size + offset * 2 + 24) + 'px));height:min(600px,calc(100vh - ' + (offset * 2) + 'px));margin-bottom:' + Math.round(size * 0.12) + 'px}' +
      '.pbody{flex:1;min-height:0;display:flex;flex-direction:column;background:#fff;border:3px solid #1b1230;border-radius:28px;box-shadow:5px 5px 0 #1b1230;overflow:hidden}' +
      '.panel:after{content:"";position:absolute;bottom:' + Math.round(size * 0.3) + 'px;' + (left ? 'left' : 'right') + ':-13px;width:20px;height:20px;background:#fff;border-' + (left ? 'left' : 'right') + ':3px solid #1b1230;border-' + (left ? 'bottom' : 'top') + ':3px solid #1b1230;transform:rotate(' + (left ? '45' : '45') + 'deg)}' +
      '.open .panel{display:flex}' +
      '.bar{display:flex;justify-content:space-between;align-items:center;gap:.5rem;background:' + color + ';color:#fff;padding:.3rem .5rem;font:700 15px system-ui,sans-serif}' +
      '.x,.full{background:#fff;color:#1b1230;border:2px solid #1b1230;border-radius:8px;padding:.25rem .6rem;font:600 13px system-ui,sans-serif;cursor:pointer;text-decoration:none}' +
      '.x:focus-visible,.full:focus-visible,.fab:focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 6px #1b1230}' +
      '.pbody iframe{flex:1;border:0;width:100%;background:#fff}' +
      '.fab{display:flex;align-items:center;gap:.5rem;border:3px solid #1b1230;background:' + color + ';color:#fff;border-radius:999px;padding:.35rem .9rem .35rem .35rem;font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;box-shadow:3px 3px 0 #1b1230}' +
      '.fab img{width:42px;height:42px;border-radius:50%;background:#fff;border:2px solid #1b1230}' +
      '.btnstyle .char{display:none}.btnstyle .fab{display:flex}.charstyle .fab{display:none}' +
      '.btnstyle.open .fab{display:none}' +
      '@media (max-width:699px),(max-height:599px){.panel{position:fixed;inset:0;width:100vw;height:100dvh;margin:0;z-index:2}.panel:after{display:none}.pbody{border:0;border-radius:0;box-shadow:none}.open .char{visibility:hidden}.open .bubble{display:none}}';
    var box = document.createElement('div'); box.className = 'dock ' + (asButton ? 'btnstyle' : 'charstyle');

    // the free-floating character
    var charEl = document.createElement('div'); charEl.className = 'char';
    var mframe = document.createElement('iframe'); mframe.className = 'mascot'; mframe.src = origin + '/embed/mascot.html'; mframe.setAttribute('tabindex', '-1'); mframe.setAttribute('aria-hidden', 'true'); mframe.setAttribute('scrolling', 'no'); mframe.title = '';
    var hit = document.createElement('button'); hit.type = 'button'; hit.className = 'hit'; hit.setAttribute('aria-haspopup', 'dialog'); hit.setAttribute('aria-expanded', 'false'); hit.setAttribute('aria-label', label + '. Press to open or minimise the chat. You can drag me anywhere.');
    var bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.setAttribute('role', 'status'); bubble.textContent = greeting;
    charEl.append(mframe, hit);
    if (!asButton) charEl.append(bubble);

    // the round button (only with data-style="button")
    var fab = document.createElement('button'); fab.type = 'button'; fab.className = 'fab'; fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
    var img = document.createElement('img'); img.src = origin + '/assets/icon-192.png'; img.alt = ''; img.width = 42; img.height = 42;
    var txt = document.createElement('span'); txt.textContent = label; fab.append(img, txt);

    // the chat
    var panel = document.createElement('div'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Phoenix, a neuro-affirming AI assistant');
    var bar = document.createElement('div'); bar.className = 'bar';
    var title = document.createElement('span'); title.textContent = 'Phoenix';
    var right = document.createElement('span'); right.style.cssText = 'display:flex;gap:.4rem';
    var full = document.createElement('a'); full.className = 'full'; full.href = origin + '/app/'; full.target = '_blank'; full.rel = 'noopener'; full.textContent = 'Full app';
    var close = document.createElement('button'); close.type = 'button'; close.className = 'x'; close.textContent = 'Minimise'; close.setAttribute('aria-label', 'Minimise Phoenix');
    right.append(full, close); bar.append(title, right);
    var pbody = document.createElement('div'); pbody.className = 'pbody'; pbody.append(bar); panel.append(pbody);
    box.append(panel, charEl, fab);
    root.append(css, box);
    document.body.appendChild(wrap);

    var chat = null, isOpen = false, bubbleTimer = null;
    function say(t, v) { try { if (mframe.contentWindow) mframe.contentWindow.postMessage({ phoenix: true, t: t, v: v }, origin); } catch (e) { /* not ready yet */ } }
    function setOpen(o, how) {
      isOpen = o; box.classList.toggle('open', o);
      hit.setAttribute('aria-expanded', String(o)); fab.setAttribute('aria-expanded', String(o));
      if (o) {
        bubble.classList.remove('show');
        if (!chat) { chat = document.createElement('iframe'); chat.title = 'Phoenix chat'; chat.setAttribute('allow', 'clipboard-write; microphone'); chat.src = origin + '/embed/?h=' + encodeURIComponent(host) + (how === 'auto' ? '&a=1' : ''); pbody.append(chat); }
        if (how === 'user') { say('act', 'wave'); remember('open'); }
        setTimeout(function () { try { if (how === 'user') chat.focus(); } catch (e) { close.focus(); } }, 50);
      } else if (how === 'user') { remember('min'); say('act', 'stretch'); hit.focus(); }
    }
    var open = function (how) { setOpen(true, how || 'user'); };
    var shut = function (how) { setOpen(false, how || 'user'); };
    var toggle = function () { isOpen ? shut() : open(); };
    close.addEventListener('click', function () { shut(); });
    fab.addEventListener('click', function () { open(); });
    bubble.addEventListener('click', function () { open(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && isOpen) shut(); });

    // drag her anywhere; a click (no drag) opens or minimises the chat
    var drag = null;
    hit.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var r = wrap.getBoundingClientRect(); drag = { x: ev.clientX, y: ev.clientY, l: r.left, t: r.top, moved: false, w: r.width, h: r.height };
      try { hit.setPointerCapture(ev.pointerId); } catch (e) { /* fine */ }
    });
    hit.addEventListener('pointermove', function (ev) {
      if (!drag) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      if (!drag.moved) { drag.moved = true; hit.classList.add('dragging'); wrap.style.right = 'auto'; wrap.style.bottom = 'auto'; wrap.style.left = drag.l + 'px'; wrap.style.top = drag.t + 'px'; }
      var nl = Math.max(0, Math.min(window.innerWidth - drag.w, drag.l + dx)), nt = Math.max(0, Math.min(window.innerHeight - drag.h, drag.t + dy));
      wrap.style.left = nl + 'px'; wrap.style.top = nt + 'px';
    });
    function endDrag() { if (!drag) return; var moved = drag.moved; drag = null; hit.classList.remove('dragging'); if (!moved) toggle(); else say('act', 'wave'); }
    hit.addEventListener('pointerup', endDrag);
    hit.addEventListener('pointercancel', function () { drag = null; hit.classList.remove('dragging'); });
    hit.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });

    // her eyes follow the visitor's pointer
    var raf = 0, px = 0, py = 0;
    function look() { raf = 0; var r = charEl.getBoundingClientRect(); try { mframe.contentWindow.postMessage({ phoenix: true, t: 'pointer', x: px - r.left, y: py - r.top }, origin); } catch (e) { /* not ready */ } }
    window.addEventListener('pointermove', function (e) { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(look); }, { passive: true });

    // what Phoenix is doing in the chat (a few fixed words, never any text) is passed to the floating character
    var RELAY = { state: 1, mood: 1, act: 1, nod: 1 };
    window.addEventListener('message', function (ev) {
      var d = ev.data; if (!d || typeof d !== 'object') return;
      if (chat && ev.source === chat.contentWindow && ev.origin === origin) {
        if (d.phoenix === 'close' && isOpen) shut();
        else if (d.phoenix === true && RELAY[d.t] && (typeof d.v === 'string' || d.t === 'nod')) say(d.t, d.v);
      }
    });

    // she says hello when she is waiting
    function greet() { if (asButton || !greeting || isOpen) return; bubble.classList.add('show'); clearTimeout(bubbleTimer); bubbleTimer = setTimeout(function () { bubble.classList.remove('show'); }, 9000); }
    window.PhoenixWidget = { open: function () { open('user'); }, close: function () { shut('user'); }, toggle: toggle };

    // He starts minimised unless the website asked for the chat to start open (or the visitor already opened it earlier in this visit)
    var wantOpen = openMode === 'true' ? remembered() !== 'min' : remembered() === 'open';
    if (wantOpen) setOpen(true, 'auto'); else setTimeout(greet, 1600);
    count('embed_load');
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
