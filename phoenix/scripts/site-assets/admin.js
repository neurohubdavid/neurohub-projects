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
  var view = $('app'), tab = 'report', me = null;

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
      el('span', {}, 'Signed in as ' + me.user), el('button', { type: 'button', 'aria-pressed': String(tab === 'report') }, 'Report'), el('button', { type: 'button', 'aria-pressed': String(tab === 'checkins') }, 'Check-in details'), el('button', { type: 'button', 'aria-pressed': String(tab === 'usage') }, 'Users and usage'),
      el('button', { type: 'button', id: 'out' }, 'Sign out')]);
    bar.children[1].onclick = function () { tab = 'report'; render(); };
    bar.children[2].onclick = function () { tab = 'checkins'; render(); };
    bar.children[3].onclick = function () { tab = 'usage'; render(); };
    bar.children[4].onclick = function () { api('logout', { method: 'POST' }).then(function () { me = null; showLogin('Signed out.'); }); };
    view.append(bar);
    var body = el('div'); view.append(body);
    (tab === 'report' ? report(body) : tab === 'checkins' ? checkins(body) : usage(body));
    if (me.recent && me.recent.length) view.append(el('details', { 'class': 'card' }, [el('summary', {}, 'Recent sign-in attempts'), el('table', {}, [el('tbody', {}, me.recent.map(function (a) { return el('tr', {}, [el('td', {}, new Date(a.at).toLocaleString()), el('td', {}, a.user), el('td', {}, a.ok ? 'signed in' : 'FAILED'), el('td', {}, a.from)]); }))])]));
  }

  // ---------------------------------------------------------------- the readable report, with a PDF
  function report(body) {
    body.append(el('p', { 'class': 'muted' }, 'Loading…'));
    get('report?weeks=12').then(function (r) {
      body.textContent = '';
      var s = r.sample, f1 = function (v) { return v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1); }, sg = function (v) { return v == null ? '-' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1); };
      body.append(el('div', { 'class': 'row' }, [el('h2', { style: 'margin:.4rem 1rem .4rem 0' }, 'Wellbeing and identity over time')]));
      var pdfBtn = el('button', { type: 'button', id: 'pdf' }, 'Download as PDF'), pdfMsg = el('span', { 'class': 'muted', role: 'status' });
      body.append(el('p', { 'class': 'row' }, [pdfBtn, pdfMsg]));
      pdfBtn.onclick = function () {
        pdfBtn.disabled = true; pdfMsg.textContent = 'Making the PDF…';
        Promise.all([import('./admin-pdf.js'), fetch('/assets/icon-192.png').then(function (x) { return x.ok ? x.arrayBuffer() : null; }).catch(function () { return null; })]).then(function (m) {
          return m[0].makeReportPdf(r, { logoBytes: m[1] ? new Uint8Array(m[1]) : null });
        }).then(function (out) {
          var a = el('a', { href: URL.createObjectURL(new Blob([out.bytes], { type: 'application/pdf' })), download: 'phoenix-wellbeing-identity-report-' + r.generated.slice(0, 10) + '.pdf' }); document.body.append(a); a.click(); a.remove();
          pdfMsg.textContent = 'Downloaded (' + out.pages + ' pages).'; pdfBtn.disabled = false;
        }).catch(function () { pdfMsg.textContent = 'Could not make the PDF.'; pdfBtn.disabled = false; });
      };
      body.append(el('div', { 'class': 'kpis' }, [kpi('Devices that have used Phoenix', s.devices == null ? 'n/a' : s.devices), kpi('People sharing check-ins', s.participants), kpi('Check-ins shared', s.checkins), kpi('Shared over a week or more', r.change ? r.change.n : 0)]));
      var hl = el('div', { 'class': 'card' }, [el('h3', { style: 'margin-top:0' }, 'What the numbers show')]);
      r.headlines.forEach(function (h) { hl.append(el('p', {}, h)); }); body.append(hl);
      var shown = r.tenure.filter(function (w) { return w.means; });
      var two = function (title, pts, ticks, label) {
        var card = el('div', { 'class': 'card' }, [el('h3', { style: 'margin-top:0' }, title)]);
        if (pts.length < 2) { card.append(el('p', { 'class': 'muted' }, 'Not shown yet: at least ' + r.minN + ' people need to have shared over several weeks.')); return card; }
        card.append(lineChart([{ label: 'Overall wellbeing', color: '#16121f', w: 4, pts: pts.map(function (p, i) { return [i, p.a]; }) }, { label: 'Identity', color: '#E11D48', w: 3, pts: pts.map(function (p, i) { return [i, p.b]; }) }], { n: pts.length, ticks: ticks, label: label }));
        card.append(el('p', { 'class': 'muted' }, 'Black: overall wellbeing. Rose: identity and autonomy. Scores 1 to 5. People behind each point: ' + pts.map(function (p) { return p.label + ': ' + p.n; }).join(' · ')));
        return card;
      };
      body.append(two('By weeks of using Phoenix', shown.map(function (w) { return { label: 'w' + (w.k + 1), a: w.means[0], b: w.means[5], n: w.n }; }), shown.map(function (w, i) { return [i, 'w' + (w.k + 1)]; }), 'Overall wellbeing and identity by weeks since each person first checked in'));
      var wk = r.weekly.filter(function (w) { return w.means; });
      body.append(two('By calendar week', wk.map(function (w) { return { label: w.week.slice(5), a: w.means[0], b: w.means[5], n: w.n }; }), wk.map(function (w, i) { return [i, w.week.slice(5)]; }), 'Group average overall wellbeing and identity by calendar week'));
      var g = el('div', { 'class': 'grid' });
      if (r.change) g.append(el('div', { 'class': 'card' }, [el('h3', { style: 'margin-top:0' }, 'First to latest check-in'), el('table', {}, [el('thead', {}, el('tr', {}, ['Area', 'First', 'Latest', 'Change'].map(function (h, i) { return el('th', { 'class': i ? 'n' : '' }, h); }))), el('tbody', {}, r.names.map(function (nm, i) { return el('tr', {}, [el('td', {}, nm), el('td', { 'class': 'n' }, f1(r.change.firstMean[i])), el('td', { 'class': 'n' }, f1(r.change.latestMean[i])), el('td', { 'class': 'n' }, sg(r.change.delta[i]))]); }))])]));
      g.append(el('div', { 'class': 'card' }, [el('h3', { style: 'margin-top:0' }, 'By how often people checked in'), el('table', {}, [el('thead', {}, el('tr', {}, ['Group', 'People', 'Wellbeing', 'Identity'].map(function (h, i) { return el('th', { 'class': i ? 'n' : '' }, h); }))), el('tbody', {}, r.usage.map(function (b) { return el('tr', {}, [el('td', {}, b.label), el('td', { 'class': 'n' }, b.n), el('td', { 'class': 'n' }, b.delta ? sg(b.delta[0]) : 'hidden'), el('td', { 'class': 'n' }, b.delta ? sg(b.delta[5]) : 'hidden')]); }))])]));
      body.append(g);
      var notes = el('details', { 'class': 'card', open: 'open' }, [el('summary', {}, 'How to read this report')]); r.notes.forEach(function (n) { notes.append(el('p', { 'class': 'muted' }, n)); }); body.append(notes);
    }).catch(function () { /* signed out: the login screen is showing */ });
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
  var top = function (t, prefix, n) { return Object.keys(t).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return [k.slice(prefix.length), t[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 10); };
  var tbl = function (title, rows) { return el('div', { 'class': 'card' }, [el('h2', {}, title), el('table', {}, [el('tbody', {}, rows.length ? rows.map(function (r) { return el('tr', {}, [el('td', {}, r[0]), el('td', { 'class': 'n' }, r[1])]); }) : [el('tr', {}, el('td', {}, 'Nothing yet'))])])]); };
  var bars = function (title, vals) { var max = Math.max.apply(null, vals.concat([1])), b = el('div', { 'class': 'bars', role: 'img', 'aria-label': title + ', most recent on the right. Peak ' + max }); vals.forEach(function (v) { var i = el('i', { title: String(v) }); i.style.height = Math.max(v ? 3 : 0, Math.round((v / max) * 118)) + 'px'; b.append(i); }); return el('div', { 'class': 'card' }, [el('h2', {}, title), b]); };
  function usage(body) {
    body.append(el('p', { 'class': 'muted' }, 'Loading…'));
    get('usage?days=30').then(function (d) {
      body.textContent = ''; var days = d.days, t = d.totals, u = d.users;
      body.append(el('h2', {}, 'Users'));
      body.append(el('p', { 'class': 'muted' }, 'Phoenix has no accounts, so users are counted as devices that have opened it. One person on two devices counts twice, and clearing browser data counts again. Counting since ' + u.since + '.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Devices that have used Phoenix', u.devicesAllTime), kpi('New devices, last 7 days', u.newDevices.last7), kpi('New devices, last 30 days', u.newDevices.last30), kpi('New devices today', u.newDevices.last1), kpi('App opens, last 7 days', u.appOpens.last7), kpi('Installed as an app', u.installedAsApp), kpi('Classic downloads', u.downloads)]));
      body.append(bars('New devices per day (last 60 days)', u.newDevicesPerDay.map(function (x) { return x.n; })), bars('App opens per day (last 60 days)', u.newDevicesPerDay.map(function (x) { return x.opens; })));
      var ug = el('div', { 'class': 'grid' }); ug.append(tbl('New devices by type', u.byPlatform.slice(0, 10)), tbl('New devices by how Phoenix is used', u.byHowUsed), tbl('New devices by country', u.byCountry)); body.append(ug);
      body.append(el('h2', {}, 'Website and app activity (last 30 days)'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Website visits', sum(days, 'e:view')), kpi('Install clicks', sum(days, 'e:install_click:landing')), kpi('Downloads', sum(days, 'e:download')), kpi('App opens', sum(days, 'e:app_open')), kpi('New devices', sum(days, 'e:first_open')), kpi('Installs as an app', sum(days, 'e:installed')), kpi('Donate clicks', sum(days, 'e:donate_click')), kpi('Free AI messages (30 days)', days.reduce(function (n, x) { return n + (x.sharedAi || 0); }, 0)), kpi('Free AI this month', d.sharedAiMonth || 0)]));
      body.append(bars('Website visits per day', days.map(function (x) { return x.counts['e:view'] || 0; })), bars('App opens per day', days.map(function (x) { return x.counts['e:app_open'] || 0; })), bars('Free AI messages per day', days.map(function (x) { return x.sharedAi || 0; })));
      var g = el('div', { 'class': 'grid' }); g.append(tbl('Where visitors came from', top(t, 'ref:')), tbl('Countries (visits)', top(t, 'country:view:')), tbl('Devices (app opens)', top(t, 'plat:app_open:')), tbl('Which AI people use', top(t, 'e:ai_kind:')), tbl('Donation amounts clicked', top(t, 'e:donate_click:')), tbl('Downloads by file', top(t, 'e:download:'))); body.append(g);
      var s30 = function (name) { return sum(days, name); }, perDay = function (name) { return days.map(function (x) { return x.counts[name] || 0; }); };
      var F = function (n) { return 'e:feature:' + n; };
      var tools = ['breathing', 'grounding', 'sensory', 'checkin', 'focus', 'tasks', 'scripts', 'plan'].map(function (n) { return ['Toolkit: ' + n, s30(F('tool_' + n))]; });

      body.append(el('h2', {}, 'How people use the app (last 30 days)'));
      body.append(el('p', { 'class': 'muted' }, 'Anonymous counts of features used. Nothing anyone writes is ever counted, only that the feature was used.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Messages answered by Phoenix AI', s30(F('chat_ai'))), kpi('Messages answered by the built-in helper', s30(F('chat_helper'))), kpi('Daily check-ins completed', s30(F('checkin_done'))), kpi('Insights page opened', s30(F('insights_open'))), kpi('Documents started', s30(F('doc_started'))), kpi('PDFs downloaded', s30(F('doc_pdf'))), kpi('AI drafts of documents', s30(F('doc_ai_draft'))), kpi('Learn pages opened', s30(F('learn_open'))), kpi('Help button opened', s30(F('help_open'))), kpi('Crisis messages shown', s30(F('crisis_shown'))), kpi('People who gave a name', s30(F('name_given')))]));
      body.append(bars('Daily check-ins completed per day', perDay(F('checkin_done'))), bars('Messages answered by Phoenix AI per day', perDay(F('chat_ai'))));
      var fg = el('div', { 'class': 'grid' });
      fg.append(tbl('Toolkit use', tools.sort(function (a, b) { return b[1] - a[1]; })), tbl('Settings choices', [['Switched Phoenix AI on', s30(F('ai_on'))], ['Switched to the built-in helper', s30(F('ai_off'))], ['Daily reminders on', s30(F('reminders_on'))], ['Daily reminders off', s30(F('reminders_off'))], ['Check-in sharing on', s30(F('share_on'))], ['Check-in sharing off', s30(F('share_off'))], ['Accessibility panel opened', s30(F('a11y_open'))], ['Install help opened', s30(F('install_sheet'))], ['Backups downloaded', s30(F('backup_export'))], ['Everything deleted', s30(F('data_deleted'))]]));
      body.append(fg);

      body.append(el('h2', {}, 'Floating Phoenix (last 30 days)'));
      body.append(el('p', { 'class': 'muted' }, 'The small always-on-top window that keeps Phoenix beside people while the main window is minimised (Edge and Chrome on computers). Opens are people who pressed Float.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Floating window opened', s30(F('float_open'))), kpi('Closed (back to main window)', s30(F('float_close'))), kpi('Messages sent while floating', s30(F('float_chat'))), kpi('Told Phoenix what they are doing', s30(F('float_activity'))), kpi('Turned gentle check-ins on', s30(F('float_nudges_on'))), kpi('Tried it where it is not supported', s30(F('float_unsupported'))), kpi('Installed as an app (30 days)', s30('e:installed')), kpi('Install clicks (30 days)', s30('e:install_click'))]));
      body.append(bars('Floating window opened per day', perDay(F('float_open'))), bars('Installs as an app per day', perDay('e:installed')));

      body.append(el('h2', {}, 'Phoenix AI (last 30 days)'));
      var ai = function (n) { return s30('e:ai_event:' + n); };
      body.append(el('div', { 'class': 'kpis' }, [kpi('AI replies given', ai('reply')), kpi('Daily limit reached (a person)', ai('limit_person')), kpi('Daily limit reached (everyone)', ai('limit_everyone')), kpi('Claude errors', ai('upstream_error')), kpi('Asked while switched off', ai('off')), kpi('Replies this month', d.sharedAiMonth || 0), kpi('Average replies per day', Math.round(ai('reply') / Math.max(days.length, 1)))]));
      body.append(bars('AI replies per day', perDay('e:ai_event:reply')), bars('Limit reached per day (a person)', perDay('e:ai_event:limit_person')));

      body.append(el('h2', {}, 'Donations (last 30 days)'));
      var clicks = s30('e:donate_click');
      var monthly = ['m5', 'm10', 'm25', 'm50', 'mother'].reduce(function (n, k) { return n + s30('e:donate_click:' + k); }, 0);
      body.append(el('p', { 'class': 'muted' }, 'Clicks show who went to the payment page. The Thank-you page views are people who finished paying (it is where Stripe sends them), so they are the closest number here to real donations. Check Stripe for amounts.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Donate window opened in the app', s30(F('donate_open'))), kpi('Donate clicks', clicks), kpi('Monthly clicks', monthly), kpi('One-off clicks', clicks - monthly), kpi('Thank-you page views (completed)', s30('e:view:/thanks/')), kpi('Weekly reminders shown', s30(F('nudge_shown'))), kpi('Reminders dismissed', s30(F('nudge_dismissed'))), kpi('Reminders switched off', s30(F('nudge_off'))), kpi('Hit the AI limit', s30(F('chat_limit')))]));
      body.append(bars('Donate clicks per day', perDay('e:donate_click')), bars('Thank-you page views per day', perDay('e:view:/thanks/')));

      body.append(el('h2', {}, 'Website widget (last 30 days)'));
      body.append(el('p', { 'class': 'muted' }, 'The floating Phoenix button other websites add with one line of code (see /add-to-your-site/). Loads are page views on those sites, opens are visitors who pressed the button, chats are messages sent inside it.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Widget loads', s30('e:embed_load')), kpi('Widget opened', s30('e:embed_open:ok')), kpi('Showing automatically', s30('e:embed_open:auto')), kpi('Widget messages sent', s30('e:embed_chat')), kpi('Websites using it', top(t, 'embedhost:embed_load:', 500).length), kpi('Donate clicks from widgets', top(t, 'embedhost:donate_click:', 500).reduce(function (n, r) { return n + r[1]; }, 0)), kpi('New people through widgets', top(t, 'embedhost:first_open:', 500).reduce(function (n, r) { return n + r[1]; }, 0)), kpi('Open rate', s30('e:embed_load') ? Math.round(100 * s30('e:embed_open:ok') / s30('e:embed_load')) + '%' : '-')]));
      body.append(bars('Widget loads per day', perDay('e:embed_load')), bars('Widget opens per day', perDay('e:embed_open')));
      var wg = el('div', { 'class': 'grid' });
      wg.append(tbl('Websites with the widget (loads)', top(t, 'embedhost:embed_load:', 25)), tbl('Websites where it is opened', top(t, 'embedhost:embed_open:', 25)), tbl('Websites where people chat', top(t, 'embedhost:embed_chat:', 25)), tbl('Widget loads by country', top(t, 'country:embed_load:')));
      body.append(wg);
      // one row per website: how it is doing, side by side
      var hosts = {}; ['embed_load', 'embed_open', 'embed_chat', 'feature', 'donate_click', 'first_open'].forEach(function (ev) { top(t, 'embedhost:' + ev + ':', 500).forEach(function (r) { (hosts[r[0]] = hosts[r[0]] || {})[ev] = r[1]; }); });
      var hostRows = Object.keys(hosts).map(function (h) { var x = hosts[h]; return { h: h, load: x.embed_load || 0, open: x.embed_open || 0, chat: x.embed_chat || 0, use: x.feature || 0, don: x.donate_click || 0, fresh: x.first_open || 0 }; }).sort(function (a, b) { return (b.open + b.chat) - (a.open + a.chat) || b.load - a.load; }).slice(0, 40);
      var wt = el('div', { 'class': 'card' }, [el('h2', {}, 'Each website with the widget'), el('p', { 'class': 'muted' }, 'Loads are page views on that site. Opened is people who pressed the button. Messages are chats sent. Uses count everything done inside Phoenix there (check-ins, tools and so on). Donate clicks are people who went to the payment page from there. New people had never used Phoenix before.'),
        el('table', {}, [el('thead', {}, el('tr', {}, ['Website', 'Loads', 'Opened', 'Open rate', 'Messages', 'Uses', 'Donate clicks', 'New people'].map(function (c, i) { return el('th', i ? { 'class': 'n' } : {}, c); }))),
          el('tbody', {}, hostRows.length ? hostRows.map(function (r) { return el('tr', {}, [el('td', {}, r.h), el('td', { 'class': 'n' }, r.load), el('td', { 'class': 'n' }, r.open), el('td', { 'class': 'n' }, r.load ? Math.round(100 * r.open / r.load) + '%' : '-'), el('td', { 'class': 'n' }, r.chat), el('td', { 'class': 'n' }, r.use), el('td', { 'class': 'n' }, r.don), el('td', { 'class': 'n' }, r.fresh)]); }) : [el('tr', {}, el('td', {}, 'Nothing yet'))])])]);
      body.append(wt);

      body.append(el('h2', {}, 'Downloads (last 30 days)'));
      var dg = el('div', { 'class': 'grid' });
      dg.append(tbl('Downloads by device', top(t, 'plat:download:')), tbl('Downloads by country', top(t, 'country:download:')));
      body.append(dg);
    }).catch(function () { /* signed out */ });
  }
  boot();
})();
