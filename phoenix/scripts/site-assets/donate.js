// The "Give once / Give monthly" switch on the front page. Without JavaScript the buttons are plain one-off links and the switch stays hidden.
(function () {
  var strip = document.getElementById('donate'); if (!strip) return;
  var freq = strip.querySelector('.freq'); if (!freq) return;
  var links = strip.querySelectorAll('a[data-once]'), note = document.getElementById('donate-note');
  freq.hidden = false; strip.setAttribute('data-mode', 'once');
  freq.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-freq]'); if (!b) return;
    var mode = b.getAttribute('data-freq'); strip.setAttribute('data-mode', mode);
    freq.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    links.forEach(function (a) { a.setAttribute('href', a.getAttribute('data-' + mode)); });
    var first = strip.querySelector('.amounts a');
    if (first) first.setAttribute('aria-label', '');
    strip.querySelectorAll('.amounts a[data-amount]').forEach(function (a) { var n = a.getAttribute('data-amount'); a.setAttribute('aria-label', (n === 'other' ? 'Choose my own amount' : 'Give £' + n) + (mode === 'monthly' ? ' every month' : ' once') + ' (opens the secure payment page)'); });
    if (mode === 'monthly') { var p = document.createElement('span'); p.className = 'sr-only'; p.setAttribute('role', 'status'); p.textContent = 'Monthly gifts are taken every month until you cancel. You can cancel yourself at any time from the receipt email.'; strip.append(p); setTimeout(function () { p.remove(); }, 4000); }
  });
})();
