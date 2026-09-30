// The private backend's screen. It only draws what the server returns, using text nodes (never as HTML), and the server refuses
// every request that is not from a signed-in person with the Admin role.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var MEASURES = ['Overall', 'Senses', 'Daily living', 'Social', 'Emotions', 'Identity', 'Strengths'];
  var COLORS = ['#16121f', '#7C3AED', '#2563EB', '#0D9488', '#D97706', '#E11D48', '#EA580C'];
  var el = function (t, a, kids) { var n = document.createElement(t); for (var k in a || {}) n.setAttribute(k, a[k]); [].concat(kids === undefined ? [] : kids).forEach(function (c) { if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  var svg = function (t, a, kids) { var n = document.createElementNS(NS, t); for (var k in a || {}) n.setAttribute(k, a[k]); [].concat(kids === undefined ? [] : kids).forEach(function (c) { n.append(c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  var api = function (path, opts) { return fetch('/api/admin/' + path, Object.assign({ credentials: 'same-origin', headers: { 'x-admin-csrf': '1', 'content-type': 'application/json' } }, opts || {})); };
  var view = $('app'), tab = 'checkins', me = null;

  function showLogin(msg) { view.hidden = true; $('login').hidden = false; $('msg').textContent = msg || ''; $('u').focus(); }
  $('form').addEventListener('submit', function (e) {
    e.preventDefault(); $('go').disabled = true; $('msg').textContent = '';
    api('login', { method: 'POST', body: JSON.stringify({ username: $('u').value, password: $('p').value, code: $('c').value }) }).then(function (r) {
      return r.json().then(function (j) { return { r: r, j: j }; });
    }).then(function (x) {
      $('go').disabled = false; $('p').value = ''; $('c').value = '';
      if (x.r.ok) return boot();
      $('msg').textContent = x.r.status === 429 ? 'Too many attempts. Try again in ' + x.j.minutes + ' minutes.' : x.r.status === 503 ? 'The backend has not been set up yet.' : 'Sign-in failed. Check your details and the current code.';
    }).catch(function () { $('go').disabled = false; $('msg').textContent = 'Could not reach the server.'; });
  });

  function boot() {
    api('me').then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); }).then(function (j) { me = j; $('login').hidden = true; view.hidden = false; render(); }).catch(function () { showLogin(); });
  }
  function get(path) { return api(path).then(function (r) { if (r.status === 401) { showLogin('Your session ended. Please sign in again.'); throw new Error('auth'); } return r.json(); }); }

  function render() {
    view.textContent = '';
    var bar = el('div', { 'class': 'row' }, [
      el('span', {}, 'Signed in as ' + me.user), el('button', { type: 'button', 'aria-pressed': String(tab === 'checkins') }, 'Check-ins'), el('button', { type: 'button', 'aria-pressed': String(tab === 'usage') }, 'Usage'),
      el('button', { type: 'button', id: 'out' }, 'Sign out')]);
    bar.children[1].onclick = function () { tab = 'checkins'; render(); };
    bar.children[2].onclick = function () { tab = 'usage'; render(); };
    bar.children[3].onclick = function () { api('logout', { method: 'POST' }).then(function () { me = null; showLogin('Signed out.'); }); };
    view.append(bar);
    var body = el('div'); view.append(body);
    (tab === 'checkins' ? checkins(body) : usage(body));
    if (me.recent && me.recent.length) view.append(el('details', { 'class': 'card' }, [el('summary', {}, 'Recent sign-in attempts'), el('table', {}, [el('tbody', {}, me.recent.map(function (a) { return el('tr', {}, [el('td', {}, new Date(a.at).toLocaleString()), el('td', {}, a.user), el('td', {}, a.ok ? 'signed in' : 'FAILED'), el('td', {}, a.from)]); }))])]));
  }

  // ---------------------------------------------------------------- check-ins
  var kpi = function (label, n) { return el('div', { 'class': 'kpi' }, [el('b', {}, n), el('span', {}, label)]); };
  function lineChart(series, opts) { // series: [{label, color, pts: [[x, y|null]]}], x is 0..n-1
    var W = 700, H = 240, L = 30, R = 10, T = 10, B = 26, n = opts.n, s = svg('svg', { 'class': 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label });
    var x = function (i) { return L + (n <= 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R)); }, y = function (v) { return T + (1 - (v - 1) / 4) * (H - T - B); };
    for (var v = 1; v <= 5; v++) { s.append(svg('line', { 'class': 'grid-l', x1: L, x2: W - R, y1: y(v), y2: y(v) }), svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, v)); }
    (opts.ticks || []).forEach(function (t) { s.append(svg('text', { x: x(t[0]), y: H - 6, 'text-anchor': 'middle' }, t[1])); });
    series.forEach(function (se) {
      var seg = [], flush = function () { if (seg.length > 1) s.append(svg('polyline', { points: seg.join(' '), fill: 'none', stroke: se.color, 'stroke-width': se.w || 2.5, opacity: se.o || 1, 'stroke-linejoin': 'round' })); else if (seg.length === 1) { var p = seg[0].split(','); s.append(svg('circle', { cx: p[0], cy: p[1], r: 3, fill: se.color })); } seg = []; };
      se.pts.forEach(function (p) { if (p[1] != null) seg.push(x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)); }); flush(); // weeks nobody shared are skipped, so the line stays joined up
    });
    return s;
  }
  function checkins(body) {
    body.append(el('p', { 'class': 'muted' }, 'Loading…'));
    get('checkins?weeks=12').then(function (d) {
      body.textContent = '';
      var s = d.summary, shown = { 0: true };
      if (!s.participants) { body.append(el('div', { 'class': 'card' }, 'Nobody has chosen to share their check-in scores yet. People are offered the choice in Settings and after their third check-in.')); return; }
      body.append(el('div', { 'class': 'kpis' }, [kpi('People sharing', s.participants), kpi('Check-ins shared', s.checkins), kpi('Active in the last 7 days', s.activeLast7), kpi('Shared 2+ times', s.retention.atLeast2), kpi('Shared 7+ times', s.retention.atLeast7)]));
      body.append(el('p', { 'class': 'muted' }, 'Anything based on fewer than ' + d.minN + ' people is hidden, so nobody can be picked out. Each person counts once per week, whatever number of times they checked in.'));
      var box = el('div', { 'class': 'card' }), chart = el('div'), tg = el('div', { 'class': 'tg' });
      var draw = function () {
        chart.textContent = '';
        var ticks = [], weeks = s.weekly;
        weeks.forEach(function (w, i) { if (i % 3 === 0) ticks.push([i, w.week.slice(5)]); });
        var series = MEASURES.map(function (m, k) { return { label: m, color: COLORS[k], w: k === 0 ? 4 : 2.2, pts: weeks.map(function (w, i) { return [i, w.means ? w.means[k] : null]; }) }; }).filter(function (se, k) { return shown[k]; });
        chart.append(lineChart(series, { n: weeks.length, ticks: ticks, label: 'Weekly average score, 1 to 5, for the people sharing' }));
        var ns = el('p', { 'class': 'muted' }, 'People per week: ' + weeks.map(function (w) { return w.week.slice(5) + ': ' + w.n; }).join(' · ')); chart.append(ns);
      };
      MEASURES.forEach(function (m, k) { var cb = el('input', { type: 'checkbox', id: 'm' + k }); if (shown[k]) cb.checked = true; cb.onchange = function () { if (cb.checked) shown[k] = true; else delete shown[k]; if (!Object.keys(shown).length) { shown[0] = true; $('m0').checked = true; } draw(); }; tg.append(el('label', {}, [cb, m])); });
      box.append(el('h2', {}, 'How the group is doing, week by week'), chart, tg); body.append(box); draw();
      var g = el('div', { 'class': 'grid' });
      if (s.change) {
        g.append(el('div', { 'class': 'card' }, [el('h2', {}, 'Change from first to latest check-in'), el('p', { 'class': 'muted' }, s.change.n + ' people, on average ' + s.change.meanDays + ' days apart.'), el('table', {}, [el('thead', {}, el('tr', {}, [el('th', {}, 'Area'), el('th', { 'class': 'n' }, 'Average change'), el('th', { 'class': 'n' }, 'Better'), el('th', { 'class': 'n' }, 'Worse')])), el('tbody', {}, MEASURES.map(function (m, k) { return el('tr', {}, [el('td', {}, m), el('td', { 'class': 'n' }, (s.change.delta[k] > 0 ? '+' : '') + s.change.delta[k]), el('td', { 'class': 'n' }, s.change.improved[k]), el('td', { 'class': 'n' }, s.change.declined[k])]); }))])]));
      } else g.append(el('div', { 'class': 'card' }, [el('h2', {}, 'Change from first to latest check-in'), el('p', { 'class': 'muted' }, 'Shown once at least ' + d.minN + ' people have checked in over a week or more.')]));
      if (s.latest) {
        var max = Math.max.apply(null, s.latest.overallCounts.concat([1])), b = el('div', { 'class': 'bars', role: 'img', 'aria-label': 'Latest overall scores 1 to 5: ' + s.latest.overallCounts.join(', ') });
        s.latest.overallCounts.forEach(function (c) { var i = el('i', { title: String(c) }); i.style.height = Math.max(c ? 4 : 0, Math.round((c / max) * 118)) + 'px'; b.append(i); });
        g.append(el('div', { 'class': 'card' }, [el('h2', {}, 'Latest overall score, per person'), b, el('p', { 'class': 'muted' }, '1 (really struggling) to 5 (thriving), left to right: ' + s.latest.overallCounts.join(', ') + ' people.')]));
      }
      body.append(g);
      var ind = el('div', { 'class': 'card' }, [el('h2', {}, 'Individual lines (anonymous)'), el('p', { 'class': 'muted' }, 'Each line is one person\'s overall score over time, labelled P1, P2… with no link to who they are. Hidden until at least ' + d.minN + ' people share.')]);
      var btn = el('button', { type: 'button' }, 'Show individual lines'); ind.append(btn); body.append(ind);
      btn.onclick = function () {
        get('checkins?weeks=12&individual=1').then(function (r) {
          if (!r.trajectories) { btn.replaceWith(el('p', { 'class': 'muted' }, 'Not enough people yet.')); return; }
          var all = []; r.trajectories.forEach(function (t) { t.days.forEach(function (p) { all.push(p[0]); }); });
          var days = Array.from(new Set(all)).sort(), idx = {}; days.forEach(function (d0, i) { idx[d0] = i; });
          var series = r.trajectories.map(function (t) { return { label: t.label, color: '#6d35d6', w: 1.4, o: 0.45, pts: t.days.map(function (p) { return [idx[p[0]], p[1]]; }) }; });
          btn.replaceWith(lineChart(series, { n: days.length, ticks: [[0, days[0].slice(2)], [days.length - 1, days[days.length - 1].slice(2)]], label: 'Overall score over time, one faint line per person' }));
        });
      };
      var csv = el('button', { type: 'button' }, 'Download weekly numbers (CSV)');
      csv.onclick = function () { var rows = [['week', 'people'].concat(MEASURES).join(',')].concat(s.weekly.map(function (w) { return [w.week, w.n].concat(w.means || MEASURES.map(function () { return ''; })).join(','); })); var a = el('a', { href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })), download: 'phoenix-weekly-checkins.csv' }); document.body.append(a); a.click(); a.remove(); };
      body.append(csv);
    }).catch(function () { /* signed out: the login screen is showing */ });
  }

  // ---------------------------------------------------------------- usage
  var sum = function (days, name) { return days.reduce(function (n, d) { return n + (d.counts[name] || 0); }, 0); };
  var top = function (t, prefix) { return Object.keys(t).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return [k.slice(prefix.length), t[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10); };
  var tbl = function (title, rows) { return el('div', { 'class': 'card' }, [el('h2', {}, title), el('table', {}, [el('tbody', {}, rows.length ? rows.map(function (r) { return el('tr', {}, [el('td', {}, r[0]), el('td', { 'class': 'n' }, r[1])]); }) : [el('tr', {}, el('td', {}, 'Nothing yet'))])])]); };
  var bars = function (title, vals) { var max = Math.max.apply(null, vals.concat([1])), b = el('div', { 'class': 'bars', role: 'img', 'aria-label': title + ', most recent on the right. Peak ' + max }); vals.forEach(function (v) { var i = el('i', { title: String(v) }); i.style.height = Math.max(v ? 3 : 0, Math.round((v / max) * 118)) + 'px'; b.append(i); }); return el('div', { 'class': 'card' }, [el('h2', {}, title), b]); };
  function usage(body) {
    body.append(el('p', { 'class': 'muted' }, 'Loading…'));
    get('usage?days=30').then(function (d) {
      body.textContent = ''; var days = d.days, t = d.totals;
      body.append(el('div', { 'class': 'kpis' }, [kpi('Website visits', sum(days, 'e:view')), kpi('Install clicks', sum(days, 'e:install_click:landing')), kpi('Downloads', sum(days, 'e:download')), kpi('App opens', sum(days, 'e:app_open')), kpi('New devices', sum(days, 'e:first_open')), kpi('Installs as an app', sum(days, 'e:installed')), kpi('Donate clicks', sum(days, 'e:donate_click')), kpi('Free AI messages (30 days)', days.reduce(function (n, x) { return n + (x.sharedAi || 0); }, 0)), kpi('Free AI this month', d.sharedAiMonth || 0)]));
      body.append(bars('Website visits per day', days.map(function (x) { return x.counts['e:view'] || 0; })), bars('App opens per day', days.map(function (x) { return x.counts['e:app_open'] || 0; })), bars('Free AI messages per day', days.map(function (x) { return x.sharedAi || 0; })));
      var g = el('div', { 'class': 'grid' }); g.append(tbl('Where visitors came from', top(t, 'ref:')), tbl('Countries (visits)', top(t, 'country:view:')), tbl('Devices (app opens)', top(t, 'plat:app_open:')), tbl('Which AI people use', top(t, 'e:ai_kind:')), tbl('Donation amounts clicked', top(t, 'e:donate_click:')), tbl('Downloads by file', top(t, 'e:download:'))); body.append(g);
    }).catch(function () { /* signed out */ });
  }
  boot();
})();
