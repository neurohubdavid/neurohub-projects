// The private backend's screen. It only draws what the server returns, using text nodes (never as HTML), and the server refuses
// every request that is not from a signed-in person with the Admin role.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var MEASURES = ['Overall', 'Senses', 'Daily living', 'Social', 'Emotions', 'Identity', 'Strengths'];
  var COLORS = ['#f4f0ff', '#8b5cf6', '#38bdf8', '#2dd4bf', '#fbbf24', '#fb7185', '#fb923c'];
  var el = function (t, a, kids) { var n = document.createElement(t); for (var k in a || {}) n.setAttribute(k, a[k]); [].concat(kids === undefined ? [] : kids).forEach(function (c) { if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  var svg = function (t, a, kids) { var n = document.createElementNS(NS, t); for (var k in a || {}) n.setAttribute(k, a[k]); [].concat(kids === undefined ? [] : kids).forEach(function (c) { n.append(c.nodeType ? c : document.createTextNode(String(c))); }); return n; };
  var api = function (path, opts) { return fetch('/api/admin/' + path, Object.assign({ credentials: 'same-origin', headers: { 'x-admin-csrf': '1', 'content-type': 'application/json' } }, opts || {})); };
  var view = $('app'), shell = $('shell'), loginWrap = $('login-wrap'), installBar = $('install-admin');
  var page = 'home', range = 30, me = null, cache = {}, loadedAt = 0, token = 0;

  // ---------------------------------------------------------------- icons (simple outlines, drawn here so nothing is fetched)
  var ICONS = {
    home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
    users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-3A3.5 3.5 0 0 0 6 17.5V19M11 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 19v-1a3 3 0 0 0-2.2-2.9M15.5 5.2a3 3 0 0 1 0 5.6',
    spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
    bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6z',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5a7.5 7.5 0 0 0 0-3l1.7-1.3-1.8-3.1-2 .8a7.5 7.5 0 0 0-2.6-1.5L14.4 3h-3.6l-.3 2.4a7.5 7.5 0 0 0-2.6 1.5l-2-.8-1.8 3.1 1.7 1.3a7.5 7.5 0 0 0 0 3l-1.7 1.3 1.8 3.1 2-.8a7.5 7.5 0 0 0 2.6 1.5l.3 2.4h3.6l.3-2.4a7.5 7.5 0 0 0 2.6-1.5l2 .8 1.8-3.1z',
    refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  };
  var icon = function (name) { return svg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' }, [svg('path', { d: ICONS[name] })]); };
  var PAGES = [['home', 'Home', 'home'], ['audience', 'Audience', 'users'], ['features', 'Features', 'spark'], ['wellbeing', 'Wellbeing', 'heart'], ['ai', 'AI and giving', 'bolt']];
  var TITLES = { home: 'Home', audience: 'Audience', features: 'Features', wellbeing: 'Wellbeing', ai: 'AI and giving', system: 'System' };

  // ---------------------------------------------------------------- sign-in
  function showLogin(msg) {
    shell.hidden = true; view.hidden = true; loginWrap.hidden = false; $('login').hidden = false; loginWrap.prepend(installBar); $('msg').textContent = msg || ''; cache = {}; $('u').focus();
  }
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
    api('me').then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); }).then(function (j) {
      me = j; loginWrap.hidden = true; $('login').hidden = true; shell.hidden = false; view.hidden = false; $('who').textContent = 'Signed in as ' + me.user; buildNav(); go(page);
    }).catch(function () { showLogin(); });
  }
  function get(path) { return api(path).then(function (r) { if (r.status === 401) { showLogin('Your session ended. Please sign in again.'); throw new Error('auth'); } return r.json(); }); }
  // one fetch per kind of data, shared by every page until Refresh (or five minutes) so moving between pages is instant
  function data(key, path) { if (cache[key]) return cache[key]; var p = get(path); cache[key] = p; p.catch(function () { delete cache[key]; }); return p; }
  var usageData = function () { return data('usage' + range, 'usage?days=' + Math.max(range, 14)); };
  var statusData = function () { return data('status', 'status'); };

  // ---------------------------------------------------------------- navigation
  function buildNav() {
    var nav = $('nav'), bar = $('tabbar'); nav.textContent = ''; bar.textContent = '';
    PAGES.forEach(function (p) {
      [nav, bar].forEach(function (host) { var b = el('button', { type: 'button', 'data-page': p[0] }, [icon(p[2]), el('span', {}, p[1])]); b.onclick = function () { go(p[0]); }; host.append(b); });
    });
    var sys = el('button', { type: 'button', 'data-page': 'system' }, [icon('gear'), el('span', {}, 'System')]); sys.onclick = function () { go('system'); }; nav.append(sys);
  }
  function go(p) {
    page = p; token++; $('title').textContent = TITLES[p] || 'Home';
    document.querySelectorAll('[data-page]').forEach(function (b) { if (b.getAttribute('data-page') === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    renderTools(); render(); window.scrollTo(0, 0);
  }
  var needsRange = { audience: 1, features: 1, ai: 1 };
  function renderTools() {
    var t = $('tools'); t.textContent = '';
    if (needsRange[page]) {
      var seg = el('div', { 'class': 'seg', role: 'group', 'aria-label': 'Time range' });
      [[7, '7 days'], [30, '30 days'], [90, '90 days']].forEach(function (r) { var b = el('button', { type: 'button', 'aria-pressed': String(range === r[0]) }, r[1]); b.onclick = function () { range = r[0]; renderTools(); render(); }; seg.append(b); });
      t.append(seg);
    }
    var rf = el('button', { type: 'button', 'class': 'icon-btn', 'aria-label': 'Refresh', title: 'Refresh' }, [icon('refresh')]); rf.onclick = function () { cache = {}; render(); };
    t.append(rf);
    if (page !== 'system') { var g = el('button', { type: 'button', 'class': 'icon-btn', 'aria-label': 'System', title: 'System' }, [icon('gear')]); g.onclick = function () { go('system'); }; t.append(g); }
  }
  function render() {
    loadedAt = Date.now(); view.textContent = ''; var my = token;
    var body = el('div'); view.append(body);
    body.append(el('div', { 'class': 'skeleton' }), el('div', { 'class': 'skeleton' }), el('div', { 'class': 'skeleton' }));
    var done = function () { body.textContent = ''; return my === token; };
    var fail = function (e) { if (e && e.message === 'auth') return; if (my === token) { body.textContent = ''; var retry = el('button', { type: 'button' }, 'Try again'); retry.onclick = function () { cache = {}; render(); }; body.append(el('div', { 'class': 'card' }, [el('p', {}, 'Could not load this page.'), retry])); } };
    var run = { home: pageHome, audience: pageAudience, features: pageFeatures, wellbeing: pageWellbeing, ai: pageAi, system: pageSystem }[page];
    Promise.resolve(run(body, done)).catch(fail);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && me && !shell.hidden && Date.now() - loadedAt > 300000) { cache = {}; render(); } });

  // ---------------------------------------------------------------- small pieces
  var kpi = function (label, n, o) {
    o = o || {}; var k = el('div', { 'class': 'kpi' + (o.spark ? ' big' : '') }, [el('b', {}, n), el('span', {}, label)]);
    if (o.delta) k.append(o.delta);
    if (o.spark) k.append(spark(o.spark));
    return k;
  };
  function spark(vals) {
    var W = 120, H = 30, max = Math.max.apply(null, vals.concat([1])), n = vals.length, pts = vals.map(function (v, i) { return [(n <= 1 ? 0 : i / (n - 1)) * W, H - 3 - (v / max) * (H - 8)]; });
    var line = pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
    var s = svg('svg', { 'class': 'sp', viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    s.append(svg('polygon', { points: '0,' + H + ' ' + line + ' ' + W + ',' + H, fill: '#8b5cf6', opacity: '.22' }), svg('polyline', { points: line, fill: 'none', stroke: '#a78bfa', 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke' }));
    return s;
  }
  function deltaPill(cur, prev) {
    var cls = 'delta', t;
    if (!prev && !cur) t = 'no change'; else if (!prev) { t = 'new'; cls += ' up'; } else { var p = Math.round(100 * (cur - prev) / prev); t = (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '%'; cls += p > 0 ? ' up' : p < 0 ? ' down' : ''; }
    return el('span', { 'class': cls, title: 'Compared with the 7 days before' }, t);
  }
  var head = function (title, sub) { return el('div', {}, [el('h2', {}, title), sub ? el('p', { 'class': 'muted small', style: 'margin:.1rem 0 .6rem' }, sub) : null]); };
  var sum = function (days, name) { return days.reduce(function (n, d) { return n + (d.counts[name] || 0); }, 0); };
  var topOf = function (t, prefix, n) { return Object.keys(t).filter(function (k) { return k.indexOf(prefix) === 0; }).map(function (k) { return [k.slice(prefix.length), t[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 10); };
  var tbl = function (title, rows) { return el('div', { 'class': 'card' }, [el('h3', {}, title), el('table', {}, [el('tbody', {}, rows.length ? rows.map(function (r) { return el('tr', {}, [el('td', {}, r[0]), el('td', { 'class': 'n' }, r[1])]); }) : [el('tr', {}, el('td', {}, 'Nothing yet'))])])]); };
  var bars = function (title, vals) { var max = Math.max.apply(null, vals.concat([1])), b = el('div', { 'class': 'bars', role: 'img', 'aria-label': title + ', most recent on the right. Peak ' + max }); vals.forEach(function (v) { var i = el('i', { title: String(v) }); i.style.height = Math.max(v ? 3 : 0, Math.round((v / max) * 118)) + 'px'; b.append(i); }); return el('div', { 'class': 'card' }, [el('h3', {}, title), b]); };
  var rl = function () { return '(last ' + range + ' days)'; };
  // usage numbers for the chosen range, worked out from the days the server sent
  function view_(d) {
    var days = d.days.slice(-range), totals = {};
    days.forEach(function (x) { Object.keys(x.counts).forEach(function (k) { totals[k] = (totals[k] || 0) + x.counts[k]; }); });
    return { d: d, all: d.days, days: days, t: totals, s: function (n) { return sum(days, n); }, per: function (n) { return days.map(function (x) { return x.counts[n] || 0; }); }, F: function (n) { return 'e:feature:' + n; } };
  }

  // ---------------------------------------------------------------- Home
  function pageHome(body, done) {
    return Promise.all([usageData(), statusData()]).then(function (r) {
      if (!done()) return;
      var d = r[0], st = r[1], all = d.days, last7 = all.slice(-7), prev7 = all.slice(-14, -7), h = new Date().getHours();
      var hello = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      var ai = st.ai, aiState = !ai.keySet ? ['bad', 'Phoenix AI: no key'] : ai.switchedOffByEnv ? ['bad', 'Phoenix AI: switched off'] : ai.paused ? ['warn', 'Phoenix AI: paused'] : ['good', 'Phoenix AI: live'];
      var chip = function (cls, text) { return el('span', { 'class': 'chip' }, [el('span', { 'class': 'dot ' + cls }), text]); };
      var hero = el('div', { 'class': 'hero' }, [el('h2', {}, hello + ', ' + me.user), el('p', {}, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) + '. Here is how Phoenix is doing.')]);
      hero.append(el('div', { 'class': 'chips' }, [chip(aiState[0], aiState[1]), chip(st.accounts.emailSetUp ? 'good' : 'bad', st.accounts.emailSetUp ? 'Sign-in emails working' : 'Sign-in emails not set up'), chip('good', (d.accountsNow || 0) + ' accounts'), chip('good', d.users.devicesAllTime + ' devices')]));
      body.append(hero);
      var tile = function (label, name, aiLike) {
        var vals = all.slice(-14).map(function (x) { return x.counts[name] || 0; }), c = sum(last7, name), p = sum(prev7, name);
        return kpi(label, c, { spark: vals, delta: deltaPill(c, p) });
      };
      body.append(el('div', { 'class': 'kpis' }, [tile('New devices, 7 days', 'e:first_open'), tile('App opens, 7 days', 'e:app_open'), tile('AI replies, 7 days', 'e:ai_event:reply'), tile('New accounts, 7 days', 'e:account:created'), tile('Widget loads, 7 days', 'e:embed_load'), tile('Donate clicks, 7 days', 'e:donate_click')]));
      // things worth a look
      var alerts = [], n7 = function (n) { return sum(last7, n); };
      if (ai.paused) alerts.push(['warn', 'Phoenix AI is paused, so people are getting the built-in helper. Resume it on the System page.']);
      if (!ai.keySet) alerts.push(['bad', 'No Anthropic key is set, so Phoenix AI is off.']);
      if (n7('e:ai_event:limit_everyone')) alerts.push(['bad', 'The shared daily or monthly limit was reached ' + n7('e:ai_event:limit_everyone') + ' times this week, so some people could not get an AI reply.']);
      if (n7('e:ai_event:upstream_error')) alerts.push(['warn', 'Claude returned an error ' + n7('e:ai_event:upstream_error') + ' times this week.']);
      if (n7('e:ai_event:limit_person') > 20) alerts.push(['warn', 'People hit their own daily AI limit ' + n7('e:ai_event:limit_person') + ' times this week. Raising it costs more.']);
      if (!st.accounts.emailSetUp) alerts.push(['bad', 'Sign-in emails are not set up, so nobody can create an account.']);
      var box = el('div', { 'class': 'card' }, [el('h3', {}, 'Needs a look')]);
      if (alerts.length) alerts.forEach(function (a) { box.append(el('div', { 'class': 'alert ' + a[0] }, [el('span', { 'class': 'dot ' + a[0], style: 'margin-top:.45rem' }), el('span', {}, a[1])])); });
      else box.append(el('div', { 'class': 'alert good' }, [el('span', { 'class': 'dot good', style: 'margin-top:.45rem' }), el('span', {}, 'Nothing needs attention. Phoenix AI is running and no limits were hit this week.')]));
      body.append(box);
      body.append(el('div', { 'class': 'grid' }, [bars('App opens, last 14 days', all.slice(-14).map(function (x) { return x.counts['e:app_open'] || 0; })), bars('AI replies, last 14 days', all.slice(-14).map(function (x) { return x.counts['e:ai_event:reply'] || 0; }))]));
      var q = el('div', { 'class': 'row' }), aiBtn = el('button', { type: 'button', 'class': ai.paused ? 'ok-btn' : 'danger' }, ai.paused ? 'Resume Phoenix AI' : 'Pause Phoenix AI');
      aiBtn.onclick = function () { setPaused(!ai.paused, aiBtn); };
      var rep = el('button', { type: 'button' }, 'Open the wellbeing report'); rep.onclick = function () { go('wellbeing'); };
      q.append(aiBtn, rep); body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Quick actions'), q]));
    });
  }
  function setPaused(paused, btn) {
    if (paused && !window.confirm('Pause Phoenix AI for everyone? People will get the built-in helper until you resume it.')) return;
    if (btn) btn.disabled = true;
    api('control', { method: 'POST', body: JSON.stringify({ aiPaused: paused }) }).then(function (r) { if (r.status === 401) { showLogin('Your session ended. Please sign in again.'); throw new Error('auth'); } return r.json(); }).then(function (st) { cache.status = Promise.resolve(st); render(); }).catch(function () { if (btn) btn.disabled = false; });
  }

  // ---------------------------------------------------------------- Audience
  function pageAudience(body, done) {
    return usageData().then(function (raw) {
      if (!done()) return; var v = view_(raw), d = raw, u = d.users, s = v.s, days = v.days, t = v.t, F = v.F;
      body.append(head('Users', 'Phoenix counts devices that have opened it, plus optional accounts. One person on two devices counts twice, and clearing browser data counts again. Counting since ' + u.since + '.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Devices that have used Phoenix', u.devicesAllTime), kpi('New devices, last 7 days', u.newDevices.last7), kpi('New devices, last 30 days', u.newDevices.last30), kpi('New devices today', u.newDevices.last1), kpi('App opens, last 7 days', u.appOpens.last7), kpi('Installed as an app', u.installedAsApp), kpi('Classic downloads', u.downloads)]));
      body.append(el('div', { 'class': 'grid' }, [bars('New devices per day (last 60 days)', u.newDevicesPerDay.map(function (x) { return x.n; })), bars('App opens per day (last 60 days)', u.newDevicesPerDay.map(function (x) { return x.opens; }))]));
      body.append(el('div', { 'class': 'grid', style: 'margin-top:1rem' }, [tbl('New devices by type', u.byPlatform.slice(0, 10)), tbl('New devices by how Phoenix is used', u.byHowUsed), tbl('New devices by country', u.byCountry)]));

      body.append(head('Website and app activity ' + rl()));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Website visits', s('e:view')), kpi('Install clicks', s('e:install_click:landing')), kpi('Downloads', s('e:download')), kpi('App opens', s('e:app_open')), kpi('New devices', s('e:first_open')), kpi('Installs as an app', s('e:installed'))]));
      body.append(el('div', { 'class': 'grid' }, [bars('Website visits per day', v.per('e:view')), bars('App opens per day', v.per('e:app_open'))]));
      body.append(el('div', { 'class': 'grid', style: 'margin-top:1rem' }, [tbl('Where visitors came from', topOf(t, 'ref:')), tbl('Countries (visits)', topOf(t, 'country:view:')), tbl('Devices (app opens)', topOf(t, 'plat:app_open:')), tbl('Downloads by file', topOf(t, 'e:download:'))]));

      body.append(head('Accounts and voice ' + rl(), 'Everyone who signs up is a User. Only an Admin can open this backend. Phoenix never stores email addresses, so these are counts only.'));
      var acc = function (n) { return s('e:account:' + n); };
      body.append(el('div', { 'class': 'kpis' }, [kpi('Accounts now (all Users)', d.accountsNow || 0), kpi('New accounts', acc('created')), kpi('Sign-ins', acc('signin')), kpi('Sign-in codes sent', acc('code_sent')), kpi('Accounts deleted', acc('deleted')), kpi('Signed out', acc('signout')), kpi('Spoken conversations started', s(F('voice_chat'))), kpi('Wake word turned on', s(F('wake_on'))), kpi('Times “Phoenix” woke Phoenix', s(F('wake_word'))), kpi('Tried voice without an account', s(F('voice_needs_account'))), kpi('Phoenix made a note', s(F('memory_added'))), kpi('Sync turned off', s(F('sync_off')))]));
      body.append(el('div', { 'class': 'grid' }, [bars('New accounts per day', v.per('e:account:created')), bars('Sign-ins per day', v.per('e:account:signin'))]));
      body.append(head('Pronoun choices ' + rl(), 'Which pronouns people give Phoenix. Nobody’s own pronouns are ever counted.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('she/her', s(F('phoenix_pronouns_she'))), kpi('he/him', s(F('phoenix_pronouns_he'))), kpi('they/them', s(F('phoenix_pronouns_they')))]));
      body.append(head('Downloads ' + rl()));
      body.append(el('div', { 'class': 'grid' }, [tbl('Downloads by device', topOf(t, 'plat:download:')), tbl('Downloads by country', topOf(t, 'country:download:'))]));
    });
  }

  // ---------------------------------------------------------------- Features
  function pageFeatures(body, done) {
    return usageData().then(function (raw) {
      if (!done()) return; var v = view_(raw), s = v.s, t = v.t, F = v.F, days = v.days;
      var tools = ['breathing', 'grounding', 'sensory', 'checkin', 'focus', 'tasks', 'scripts', 'plan'].map(function (n) { return ['Toolkit: ' + n, s(F('tool_' + n))]; });
      body.append(head('How people use the app ' + rl(), 'Anonymous counts of features used. Nothing anyone writes is ever counted, only that the feature was used.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Messages answered by Phoenix AI', s(F('chat_ai'))), kpi('Messages answered by the built-in helper', s(F('chat_helper'))), kpi('Daily check-ins completed', s(F('checkin_done'))), kpi('Insights page opened', s(F('insights_open'))), kpi('Documents started', s(F('doc_started'))), kpi('PDFs downloaded', s(F('doc_pdf'))), kpi('AI drafts of documents', s(F('doc_ai_draft'))), kpi('Learn pages opened', s(F('learn_open'))), kpi('Help button opened', s(F('help_open'))), kpi('Crisis messages shown', s(F('crisis_shown'))), kpi('People who gave a name', s(F('name_given'))), kpi('Suggestions asked for', s(F('recommend_asked'))), kpi('Suggestions offered by Phoenix', s(F('recommend_given')))]));
      body.append(el('div', { 'class': 'grid' }, [bars('Daily check-ins completed per day', v.per(F('checkin_done'))), bars('Messages answered by Phoenix AI per day', v.per(F('chat_ai')))]));
      body.append(el('div', { 'class': 'grid', style: 'margin-top:1rem' }, [tbl('Toolkit use', tools.sort(function (a, b) { return b[1] - a[1]; })), tbl('Settings choices', [['Switched Phoenix AI on', s(F('ai_on'))], ['Switched to the built-in helper', s(F('ai_off'))], ['Daily reminders on', s(F('reminders_on'))], ['Daily reminders off', s(F('reminders_off'))], ['Check-in sharing on', s(F('share_on'))], ['Check-in sharing off', s(F('share_off'))], ['Accessibility panel opened', s(F('a11y_open'))], ['Install help opened', s(F('install_sheet'))], ['Backups downloaded', s(F('backup_export'))], ['Everything deleted', s(F('data_deleted'))]])]));

      body.append(head('Floating Phoenix and desktop ' + rl(), 'The small always-on-top window (Edge and Chrome on computers) and the Phoenix desktop program. Opens are people who pressed Float.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Floating window opened', s(F('float_open'))), kpi('Closed (back to main window)', s(F('float_close'))), kpi('Messages sent while floating', s(F('float_chat'))), kpi('Told Phoenix what they are doing', s(F('float_activity'))), kpi('Turned gentle check-ins on', s(F('float_nudges_on'))), kpi('Tried it where it is not supported', s(F('float_unsupported'))), kpi('Installed as an app', s('e:installed')), kpi('Install clicks', s('e:install_click')), kpi('Desktop program started', s(F('desktop_app_open')))]));
      body.append(el('div', { 'class': 'grid' }, [bars('Floating window opened per day', v.per(F('float_open'))), bars('Installs as an app per day', v.per('e:installed')), bars('Desktop Phoenix started per day', v.per(F('desktop_app_open')))]));

      body.append(head('Website widget ' + rl(), 'The floating Phoenix other websites add with one line of code (see /add-to-your-site/). Loads are page views on those sites, opens are visitors who pressed Phoenix, chats are messages sent inside it.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Widget loads', s('e:embed_load')), kpi('Widget opened', s('e:embed_open:ok')), kpi('Showing automatically', s('e:embed_open:auto')), kpi('Widget messages sent', s('e:embed_chat')), kpi('Websites using it', topOf(t, 'embedhost:embed_load:', 500).length), kpi('Donate clicks from widgets', topOf(t, 'embedhost:donate_click:', 500).reduce(function (n, r) { return n + r[1]; }, 0)), kpi('New people through widgets', topOf(t, 'embedhost:first_open:', 500).reduce(function (n, r) { return n + r[1]; }, 0)), kpi('Open rate', s('e:embed_load') ? Math.round(100 * s('e:embed_open:ok') / s('e:embed_load')) + '%' : '-')]));
      body.append(el('div', { 'class': 'grid' }, [bars('Widget loads per day', v.per('e:embed_load')), bars('Widget opens per day', v.per('e:embed_open'))]));
      body.append(el('div', { 'class': 'grid', style: 'margin-top:1rem' }, [tbl('Websites with the widget (loads)', topOf(t, 'embedhost:embed_load:', 25)), tbl('Websites where it is opened', topOf(t, 'embedhost:embed_open:', 25)), tbl('Websites where people chat', topOf(t, 'embedhost:embed_chat:', 25)), tbl('Widget loads by country', topOf(t, 'country:embed_load:'))]));
      var hosts = {}; ['embed_load', 'embed_open', 'embed_chat', 'feature', 'donate_click', 'first_open'].forEach(function (ev) { topOf(t, 'embedhost:' + ev + ':', 500).forEach(function (r) { (hosts[r[0]] = hosts[r[0]] || {})[ev] = r[1]; }); });
      var hostRows = Object.keys(hosts).map(function (h) { var x = hosts[h]; return { h: h, load: x.embed_load || 0, open: x.embed_open || 0, chat: x.embed_chat || 0, use: x.feature || 0, don: x.donate_click || 0, fresh: x.first_open || 0 }; }).sort(function (a, b) { return (b.open + b.chat) - (a.open + a.chat) || b.load - a.load; }).slice(0, 40);
      body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Each website with the widget'), el('p', { 'class': 'muted small' }, 'Loads are page views on that site. Opened is people who pressed Phoenix. Messages are chats sent. Uses count everything done inside Phoenix there. Donate clicks went to the payment page from there. New people had never used Phoenix before.'),
        el('table', {}, [el('thead', {}, el('tr', {}, ['Website', 'Loads', 'Opened', 'Open rate', 'Messages', 'Uses', 'Donate clicks', 'New people'].map(function (c, i) { return el('th', i ? { 'class': 'n' } : {}, c); }))),
          el('tbody', {}, hostRows.length ? hostRows.map(function (r) { return el('tr', {}, [el('td', {}, r.h), el('td', { 'class': 'n' }, r.load), el('td', { 'class': 'n' }, r.open), el('td', { 'class': 'n' }, r.load ? Math.round(100 * r.open / r.load) + '%' : '-'), el('td', { 'class': 'n' }, r.chat), el('td', { 'class': 'n' }, r.use), el('td', { 'class': 'n' }, r.don), el('td', { 'class': 'n' }, r.fresh)]); }) : [el('tr', {}, el('td', {}, 'Nothing yet'))])])]));
    });
  }

  // ---------------------------------------------------------------- AI and giving
  function pageAi(body, done) {
    return Promise.all([usageData(), statusData()]).then(function (r) {
      if (!done()) return; var v = view_(r[0]), st = r[1], d = r[0], s = v.s, F = v.F, days = v.days;
      body.append(head('Phoenix AI ' + rl()));
      var ai = function (n) { return s('e:ai_event:' + n); };
      var cap = st.ai;
      body.append(el('div', { 'class': 'kpis' }, [kpi('AI replies given', ai('reply')), kpi('Daily limit reached (a person)', ai('limit_person')), kpi('Daily limit reached (everyone)', ai('limit_everyone')), kpi('Claude errors', ai('upstream_error')), kpi('Asked while switched off or paused', ai('off')), kpi('Replies this month', d.sharedAiMonth || 0), kpi('Average replies per day', Math.round(ai('reply') / Math.max(days.length, 1)))]));
      body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Limits right now'), el('p', { 'class': 'muted small', style: 'margin:.2rem 0 .6rem' }, 'These keep the cost of Phoenix AI under control. They are set on the server.'), el('table', {}, [el('tbody', {}, [['Model', cap.model], ['Replies per person per day (signed out)', cap.perPerson], ['Replies per account per day', cap.perAccount], ['Replies for everyone per day', cap.globalDaily], ['Replies for everyone per month', cap.globalMonthly]].map(function (x) { return el('tr', {}, [el('td', {}, x[0]), el('td', { 'class': 'n' }, x[1])]); }))])]));
      body.append(el('div', { 'class': 'grid' }, [bars('AI replies per day', v.per('e:ai_event:reply')), bars('Limit reached per day (a person)', v.per('e:ai_event:limit_person'))]));
      body.append(el('div', { 'class': 'grid', style: 'margin-top:1rem' }, [tbl('Which AI people use', topOf(v.t, 'e:ai_kind:'))]));
      body.append(head('Donations ' + rl()));
      var clicks = s('e:donate_click'), monthly = ['m5', 'm10', 'm25', 'm50', 'mother'].reduce(function (n, k) { return n + s('e:donate_click:' + k); }, 0);
      body.append(el('p', { 'class': 'muted small' }, 'Clicks show who went to the payment page. The Thank-you page views are people who finished paying (it is where Stripe sends them), so they are the closest number here to real donations. Check Stripe for amounts.'));
      body.append(el('div', { 'class': 'kpis' }, [kpi('Donate window opened in the app', s(F('donate_open'))), kpi('Donate clicks', clicks), kpi('Monthly clicks', monthly), kpi('One-off clicks', clicks - monthly), kpi('Thank-you page views (completed)', s('e:view:/thanks/')), kpi('Weekly reminders shown', s(F('nudge_shown'))), kpi('Reminders dismissed', s(F('nudge_dismissed'))), kpi('Reminders switched off', s(F('nudge_off'))), kpi('Hit the AI limit', s(F('chat_limit')))]));
      body.append(el('div', { 'class': 'grid' }, [bars('Donate clicks per day', v.per('e:donate_click')), bars('Thank-you page views per day', v.per('e:view:/thanks/')), tbl('Donation amounts clicked', topOf(v.t, 'e:donate_click:'))]));
    });
  }

  // ---------------------------------------------------------------- Wellbeing: the report and the check-in details
  var wbTab = 'report';
  function pageWellbeing(body, done) {
    var seg = el('div', { 'class': 'seg', role: 'group', 'aria-label': 'Wellbeing view', style: 'margin-bottom:.4rem' });
    [['report', 'Report'], ['checkins', 'Check-in details']].forEach(function (x) { var b = el('button', { type: 'button', 'aria-pressed': String(wbTab === x[0]) }, x[1]); b.onclick = function () { wbTab = x[0]; render(); }; seg.append(b); });
    done(); body.append(seg); var inner = el('div'); body.append(inner);
    return wbTab === 'report' ? report(inner) : checkins(inner);
  }
  function report(body) {
    body.append(el('div', { 'class': 'skeleton' }));
    return data('report', 'report?weeks=12').then(function (r) {
      body.textContent = '';
      var s = r.sample, f1 = function (v) { return v == null ? '-' : (Math.round(v * 10) / 10).toFixed(1); }, sg = function (v) { return v == null ? '-' : (v > 0 ? '+' : '') + (Math.round(v * 10) / 10).toFixed(1); };
      body.append(head('Wellbeing and identity over time'));
      var pdfBtn = el('button', { type: 'button', id: 'pdf', 'class': 'primary' }, 'Download as PDF'), pdfMsg = el('span', { 'class': 'muted', role: 'status' });
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
      var hl = el('div', { 'class': 'card' }, [el('h3', {}, 'What the numbers show')]);
      r.headlines.forEach(function (h) { hl.append(el('p', {}, h)); }); body.append(hl);
      var shown = r.tenure.filter(function (w) { return w.means; });
      var two = function (title, pts, ticks, label) {
        var card = el('div', { 'class': 'card' }, [el('h3', {}, title)]);
        if (pts.length < 2) { card.append(el('p', { 'class': 'muted' }, 'Not shown yet: at least ' + r.minN + ' people need to have shared over several weeks.')); return card; }
        card.append(lineChart([{ label: 'Overall wellbeing', color: COLORS[0], w: 4, pts: pts.map(function (p, i) { return [i, p.a]; }) }, { label: 'Identity', color: COLORS[5], w: 3, pts: pts.map(function (p, i) { return [i, p.b]; }) }], { n: pts.length, ticks: ticks, label: label }));
        card.append(el('p', { 'class': 'muted small' }, 'White: overall wellbeing. Rose: identity and autonomy. Scores 1 to 5. People behind each point: ' + pts.map(function (p) { return p.label + ': ' + p.n; }).join(' · ')));
        return card;
      };
      body.append(two('By weeks of using Phoenix', shown.map(function (w) { return { label: 'w' + (w.k + 1), a: w.means[0], b: w.means[5], n: w.n }; }), shown.map(function (w, i) { return [i, 'w' + (w.k + 1)]; }), 'Overall wellbeing and identity by weeks since each person first checked in'));
      var wk = r.weekly.filter(function (w) { return w.means; });
      body.append(two('By calendar week', wk.map(function (w) { return { label: w.week.slice(5), a: w.means[0], b: w.means[5], n: w.n }; }), wk.map(function (w, i) { return [i, w.week.slice(5)]; }), 'Group average overall wellbeing and identity by calendar week'));
      var g = el('div', { 'class': 'grid' });
      if (r.change) g.append(el('div', { 'class': 'card' }, [el('h3', {}, 'First to latest check-in'), el('table', {}, [el('thead', {}, el('tr', {}, ['Area', 'First', 'Latest', 'Change'].map(function (h, i) { return el('th', { 'class': i ? 'n' : '' }, h); }))), el('tbody', {}, r.names.map(function (nm, i) { return el('tr', {}, [el('td', {}, nm), el('td', { 'class': 'n' }, f1(r.change.firstMean[i])), el('td', { 'class': 'n' }, f1(r.change.latestMean[i])), el('td', { 'class': 'n' }, sg(r.change.delta[i]))]); }))])]));
      g.append(el('div', { 'class': 'card' }, [el('h3', {}, 'By how often people checked in'), el('table', {}, [el('thead', {}, el('tr', {}, ['Group', 'People', 'Wellbeing', 'Identity'].map(function (h, i) { return el('th', { 'class': i ? 'n' : '' }, h); }))), el('tbody', {}, r.usage.map(function (b) { return el('tr', {}, [el('td', {}, b.label), el('td', { 'class': 'n' }, b.n), el('td', { 'class': 'n' }, b.delta ? sg(b.delta[0]) : 'hidden'), el('td', { 'class': 'n' }, b.delta ? sg(b.delta[5]) : 'hidden')]); }))])]));
      body.append(g);
      var notes = el('details', { 'class': 'card', open: 'open' }, [el('summary', {}, 'How to read this report')]); r.notes.forEach(function (n) { notes.append(el('p', { 'class': 'muted' }, n)); }); body.append(notes);
    });
  }
  function lineChart(series, opts) { // series: [{label, color, pts: [[x, y|null]]}], x is 0..n-1
    var W = 700, H = 240, L = 30, R = 10, T = 10, B = 26, n = opts.n, s = svg('svg', { 'class': 'chart', viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label });
    var x = function (i) { return L + (n <= 1 ? (W - L - R) / 2 : (i / (n - 1)) * (W - L - R)); }, y = function (v) { return T + (1 - (v - 1) / 4) * (H - T - B); };
    for (var v = 1; v <= 5; v++) { s.append(svg('line', { 'class': 'grid-l', x1: L, x2: W - R, y1: y(v), y2: y(v) }), svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, v)); }
    (opts.ticks || []).forEach(function (t) { s.append(svg('text', { x: x(t[0]), y: H - 6, 'text-anchor': 'middle' }, t[1])); });
    series.forEach(function (se) {
      var seg = [], flush = function () { if (seg.length > 1) s.append(svg('polyline', { points: seg.join(' '), fill: 'none', stroke: se.color, 'stroke-width': se.w || 2.5, opacity: se.o || 1, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })); else if (seg.length === 1) { var p = seg[0].split(','); s.append(svg('circle', { cx: p[0], cy: p[1], r: 3, fill: se.color })); } seg = []; };
      se.pts.forEach(function (p) { if (p[1] != null) seg.push(x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)); }); flush(); // weeks nobody shared are skipped, so the line stays joined up
    });
    return s;
  }
  function checkins(body) {
    body.append(el('div', { 'class': 'skeleton' }));
    return data('checkins', 'checkins?weeks=12').then(function (d) {
      body.textContent = '';
      var s = d.summary, shown = { 0: true };
      if (!s.participants) { body.append(el('div', { 'class': 'card' }, 'Nobody has chosen to share their check-in scores yet. People are offered the choice in Settings and after their third check-in.')); return; }
      body.append(el('div', { 'class': 'kpis' }, [kpi('People sharing', s.participants), kpi('Check-ins shared', s.checkins), kpi('Active in the last 7 days', s.activeLast7), kpi('Shared 2+ times', s.retention.atLeast2), kpi('Shared 7+ times', s.retention.atLeast7)]));
      body.append(el('p', { 'class': 'muted small' }, 'Anything based on fewer than ' + d.minN + ' people is hidden, so nobody can be picked out. Each person counts once per week, whatever number of times they checked in.'));
      var box = el('div', { 'class': 'card' }), chart = el('div'), tg = el('div', { 'class': 'tg' });
      var draw = function () {
        chart.textContent = '';
        var ticks = [], weeks = s.weekly;
        weeks.forEach(function (w, i) { if (i % 3 === 0) ticks.push([i, w.week.slice(5)]); });
        var series = MEASURES.map(function (m, k) { return { label: m, color: COLORS[k], w: k === 0 ? 4 : 2.2, pts: weeks.map(function (w, i) { return [i, w.means ? w.means[k] : null]; }) }; }).filter(function (se, k) { return shown[k]; });
        chart.append(lineChart(series, { n: weeks.length, ticks: ticks, label: 'Weekly average score, 1 to 5, for the people sharing' }));
        chart.append(el('p', { 'class': 'muted small' }, 'People per week: ' + weeks.map(function (w) { return w.week.slice(5) + ': ' + w.n; }).join(' · ')));
      };
      MEASURES.forEach(function (m, k) { var cb = el('input', { type: 'checkbox', id: 'm' + k }); if (shown[k]) cb.checked = true; cb.onchange = function () { if (cb.checked) shown[k] = true; else delete shown[k]; if (!Object.keys(shown).length) { shown[0] = true; $('m0').checked = true; } draw(); }; tg.append(el('label', {}, [cb, m])); });
      box.append(el('h3', {}, 'How the group is doing, week by week'), chart, tg); body.append(box); draw();
      var g = el('div', { 'class': 'grid' });
      if (s.change) {
        g.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Change from first to latest check-in'), el('p', { 'class': 'muted small' }, s.change.n + ' people, on average ' + s.change.meanDays + ' days apart.'), el('table', {}, [el('thead', {}, el('tr', {}, [el('th', {}, 'Area'), el('th', { 'class': 'n' }, 'Average change'), el('th', { 'class': 'n' }, 'Better'), el('th', { 'class': 'n' }, 'Worse')])), el('tbody', {}, MEASURES.map(function (m, k) { return el('tr', {}, [el('td', {}, m), el('td', { 'class': 'n' }, (s.change.delta[k] > 0 ? '+' : '') + s.change.delta[k]), el('td', { 'class': 'n' }, s.change.improved[k]), el('td', { 'class': 'n' }, s.change.declined[k])]); }))])]));
      } else g.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Change from first to latest check-in'), el('p', { 'class': 'muted' }, 'Shown once at least ' + d.minN + ' people have checked in over a week or more.')]));
      if (s.latest) {
        var max = Math.max.apply(null, s.latest.overallCounts.concat([1])), b = el('div', { 'class': 'bars', role: 'img', 'aria-label': 'Latest overall scores 1 to 5: ' + s.latest.overallCounts.join(', ') });
        s.latest.overallCounts.forEach(function (c) { var i = el('i', { title: String(c) }); i.style.height = Math.max(c ? 4 : 0, Math.round((c / max) * 118)) + 'px'; b.append(i); });
        g.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Latest overall score, per person'), b, el('p', { 'class': 'muted small' }, '1 (really struggling) to 5 (thriving), left to right: ' + s.latest.overallCounts.join(', ') + ' people.')]));
      }
      body.append(g);
      var ind = el('div', { 'class': 'card' }, [el('h3', {}, 'Individual lines (anonymous)'), el('p', { 'class': 'muted small' }, 'Each line is one person\'s overall score over time, labelled P1, P2… with no link to who they are. Hidden until at least ' + d.minN + ' people share.')]);
      var btn = el('button', { type: 'button' }, 'Show individual lines'); ind.append(btn); body.append(ind);
      btn.onclick = function () {
        get('checkins?weeks=12&individual=1').then(function (r) {
          if (!r.trajectories) { btn.replaceWith(el('p', { 'class': 'muted' }, 'Not enough people yet.')); return; }
          var all = []; r.trajectories.forEach(function (t) { t.days.forEach(function (p) { all.push(p[0]); }); });
          var days = Array.from(new Set(all)).sort(), idx = {}; days.forEach(function (d0, i) { idx[d0] = i; });
          var series = r.trajectories.map(function (t) { return { label: t.label, color: '#a78bfa', w: 1.4, o: 0.5, pts: t.days.map(function (p) { return [idx[p[0]], p[1]]; }) }; });
          btn.replaceWith(lineChart(series, { n: days.length, ticks: [[0, days[0].slice(2)], [days.length - 1, days[days.length - 1].slice(2)]], label: 'Overall score over time, one faint line per person' }));
        }).catch(function () { /* signed out */ });
      };
      var csv = el('button', { type: 'button' }, 'Download weekly numbers (CSV)');
      csv.onclick = function () { var rows = [['week', 'people'].concat(MEASURES).join(',')].concat(s.weekly.map(function (w) { return [w.week, w.n].concat(w.means || MEASURES.map(function () { return ''; })).join(','); })); var a = el('a', { href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })), download: 'phoenix-weekly-checkins.csv' }); document.body.append(a); a.click(); a.remove(); };
      body.append(csv);
    });
  }

  // ---------------------------------------------------------------- System: controls, what is set up, sign-ins, the app itself
  function pageSystem(body, done) {
    return statusData().then(function (st) {
      if (!done()) return;
      var ai = st.ai, state = !ai.keySet ? ['bad', 'No Anthropic key is set, so Phoenix AI is off.'] : ai.switchedOffByEnv ? ['bad', 'Phoenix AI is switched off in the server settings.'] : ai.paused ? ['warn', 'Phoenix AI is paused. People get the built-in helper.'] : ['good', 'Phoenix AI is live.'];
      var btn = el('button', { type: 'button', id: 'ai-toggle', 'class': ai.paused ? 'ok-btn' : 'danger' }, ai.paused ? 'Resume Phoenix AI' : 'Pause Phoenix AI');
      btn.disabled = !ai.keySet || ai.switchedOffByEnv; btn.onclick = function () { setPaused(!ai.paused, btn); };
      body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Phoenix AI'), el('div', { 'class': 'alert ' + state[0] }, [el('span', { 'class': 'dot ' + state[0], style: 'margin-top:.45rem' }), el('span', { id: 'ai-state' }, state[1])]), el('p', { 'class': 'muted small' }, 'Pausing takes effect straight away, for everyone, and can be undone here at any time. It is logged with your name.'), btn]));
      var yes = function (ok, text) { return el('tr', {}, [el('td', {}, text), el('td', { 'class': 'n' }, el('span', { 'class': 'chip' }, [el('span', { 'class': 'dot ' + (ok ? 'good' : 'bad') }), ok ? 'Yes' : 'No']))]); };
      body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'What is set up'), el('p', { 'class': 'muted small' }, 'Yes or no only. Secrets are never shown here.'), el('table', {}, [el('tbody', {}, [yes(ai.keySet, 'Anthropic key for Phoenix AI'), yes(st.accounts.emailSetUp, 'Sign-in emails (Brevo and sender address)'), yes(st.accounts.dataKeySet, 'Data key for sealing account data'), el('tr', {}, [el('td', {}, 'Accounts marked Admin in Phoenix'), el('td', { 'class': 'n' }, st.accounts.adminAccounts)]), el('tr', {}, [el('td', {}, 'People who can sign in to this backend'), el('td', { 'class': 'n' }, st.backendUsers)])])])]));
      if (st.changes.length) body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Recent changes'), el('table', {}, [el('tbody', {}, st.changes.map(function (c) { return el('tr', {}, [el('td', {}, new Date(c.at).toLocaleString()), el('td', {}, c.user), el('td', {}, c.what)]); }))])]));
      if (me.recent && me.recent.length) body.append(el('details', { 'class': 'card' }, [el('summary', {}, 'Recent sign-in attempts'), el('table', {}, [el('tbody', {}, me.recent.map(function (a) { return el('tr', {}, [el('td', {}, new Date(a.at).toLocaleString()), el('td', {}, a.user), el('td', {}, a.ok ? 'signed in' : 'FAILED'), el('td', {}, a.from)]); }))])]));
      body.append(installBar);
      var out = el('button', { type: 'button', id: 'out' }, 'Sign out'); out.onclick = function () { api('logout', { method: 'POST' }).then(function () { me = null; showLogin('Signed out.'); }); };
      body.append(el('div', { 'class': 'card' }, [el('h3', {}, 'Signed in as ' + me.user), el('p', { 'class': 'muted small' }, 'Signing out ends this session on this device only.'), out]));
    });
  }
  boot();
})();
