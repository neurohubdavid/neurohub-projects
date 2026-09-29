// Private dashboard: fetches /api/stats with the access key (kept only for this browser tab) and draws totals, daily bars and breakdowns.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var out = $('out'), msg = $('msg');
  try { $('key').value = sessionStorage.getItem('phoenix.statsKey') || ''; } catch (e) { /* ignore */ }
  var el = function (t, a, kids) { var n = document.createElement(t); for (var k in a || {}) n.setAttribute(k, a[k]); [].concat(kids || []).forEach(function (c) { n.append(c && c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  var sum = function (days, name) { return days.reduce(function (n, d) { return n + (d.counts[name] || 0); }, 0); };
  var series = function (days, name) { return days.map(function (d) { return d.counts[name] || 0; }); };
  var bars = function (vals) { var max = Math.max.apply(null, vals.concat([1])); var b = el('div', { 'class': 'bars', role: 'img', 'aria-label': 'Daily counts, most recent on the right. Peak ' + max + '.' }); vals.forEach(function (v) { var i = el('i', { title: String(v) }); i.style.height = Math.max(v ? 3 : 0, Math.round((v / max) * 118)) + 'px'; b.append(i); }); return b; };
  var top = function (totals, prefix, n) { return Object.keys(totals).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return [k.slice(prefix.length), totals[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 10); };
  var table = function (title, rows) { var t = el('table', {}, [el('thead', {}, el('tr', {}, [el('th', {}, title), el('th', { 'class': 'n' }, 'Count')])), el('tbody', {}, rows.length ? rows.map(function (r) { return el('tr', {}, [el('td', {}, r[0]), el('td', { 'class': 'n' }, r[1])]); }) : [el('tr', {}, [el('td', { colspan: 2 }, 'Nothing yet')])])]); return el('div', { 'class': 'card' }, [el('h2', {}, title), t]); };
  var kpi = function (label, n) { return el('div', { 'class': 'kpi' }, [el('b', {}, n), el('span', {}, label)]); };

  function draw(data) {
    var d = data.days, t = data.totals;
    out.textContent = ''; out.hidden = false;
    out.append(el('div', { 'class': 'kpis' }, [
      kpi('Website visits', sum(d, 'e:view')), kpi('Install clicks (website)', sum(d, 'e:install_click:landing')), kpi('Downloads', sum(d, 'e:download')),
      kpi('App opens', sum(d, 'e:app_open')), kpi('New devices (first opens)', sum(d, 'e:first_open')), kpi('Installs as an app', sum(d, 'e:installed')),
      kpi('Donate clicks', sum(d, 'e:donate_click')), kpi('Free AI messages', d.reduce(function (n, x) { return n + (x.sharedAi || 0); }, 0)), kpi('Free AI this month', data.sharedAiMonth || 0)]));
    [['Website visits per day', 'e:view'], ['App opens per day', 'e:app_open'], ['Downloads per day', 'e:download']].forEach(function (p) { out.append(el('div', { 'class': 'card' }, [el('h2', {}, p[0]), bars(series(d, p[1]))])); });
    out.append(el('div', { 'class': 'card' }, [el('h2', {}, 'Free AI messages per day'), bars(d.map(function (x) { return x.sharedAi || 0; }))]));
    var g = el('div', { 'class': 'grid' });
    g.append(table('Where visitors came from', top(t, 'ref:')), table('Pages viewed', top(t, 'e:view:')), table('Countries (visits)', top(t, 'country:view:')),
      table('Devices (visits)', top(t, 'plat:view:')), table('Devices (app opens)', top(t, 'plat:app_open:')), table('How the app is opened', top(t, 'e:app_open:')),
      table('Downloads by file', top(t, 'e:download:')), table('Which AI people choose', top(t, 'e:ai_kind:')), table('Donation amounts clicked', top(t, 'e:donate_click:')));
    out.append(g);
    var csvBtn = el('button', { type: 'button' }, 'Download daily numbers (CSV)');
    csvBtn.onclick = function () {
      var names = Object.keys(t).filter(function (k) { return k.indexOf('e:') === 0; }).sort();
      var rows = [['day'].concat(names).concat(['free_ai_messages']).join(',')].concat(d.map(function (x) { return [x.day].concat(names.map(function (n) { return x.counts[n] || 0; })).concat([x.sharedAi || 0]).join(','); }));
      var a = el('a', { href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })), download: 'phoenix-numbers.csv' }); document.body.append(a); a.click(); a.remove();
    };
    out.append(csvBtn, el('p', { 'class': 'muted' }, 'Generated ' + data.generated + '. Counts are approximate.'));
  }

  function load() {
    var key = $('key').value.trim(); msg.textContent = '';
    if (!key) { msg.textContent = 'Enter the access key.'; return; }
    fetch('/api/stats?days=' + $('days').value, { headers: { 'x-stats-key': key } }).then(function (r) {
      if (r.status === 401) throw new Error('That key was not accepted.');
      if (r.status === 503) throw new Error('Numbers are not switched on yet: the access key has not been set on the server.');
      if (!r.ok) throw new Error('Something went wrong (' + r.status + ').');
      return r.json();
    }).then(function (data) { try { sessionStorage.setItem('phoenix.statsKey', key); } catch (e) { /* ignore */ } draw(data); }).catch(function (e) { msg.textContent = e.message; });
  }
  $('go').onclick = load; $('days').onchange = function () { if ($('key').value) load(); };
  $('key').addEventListener('keydown', function (e) { if (e.key === 'Enter') load(); });
  if ($('key').value) load();
})();
