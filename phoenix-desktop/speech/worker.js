// Speech to text for Phoenix Desktop, entirely on this computer. The browser's own speech recognition is not available in this program
// (it needs Google's servers), so Phoenix uses Vosk, a small open speech engine, running offline. Audio from the microphone goes to the
// engine in this hidden window and nowhere else; only the words it hears are sent back, and only to the Phoenix chat that asked.
// One listening session at a time, like a browser: starting a new one ends the old one.
(function () {
  'use strict';
  var host = window.speechHost, MODEL_URL = 'phoenix-speech://app/model.tar.gz', RATE = 16000, NO_SPEECH_MS = 8000;
  var model = null, modelP = null, cur = null;
  var send = function (m) { host.send(m); };

  function loadModel() {
    if (model) return Promise.resolve(model);
    if (!modelP) modelP = window.Vosk.createModel(MODEL_URL).then(function (m) { model = m; return m; }, function (e) { modelP = null; throw e; });
    return modelP;
  }

  // ends a session: stops the microphone at once (so the system's microphone light goes off), then says it has ended
  function finish(s, error) {
    if (!s || s.over) return; s.over = true; clearTimeout(s.timer);
    try { if (s.node) { s.node.onaudioprocess = null; s.node.disconnect(); } } catch (e) { /* already gone */ }
    try { if (s.src) s.src.disconnect(); } catch (e) { /* already gone */ }
    try { if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* already stopped */ }
    try { if (s.ctx) s.ctx.close(); } catch (e) { /* already closed */ }
    try { if (s.rec) s.rec.remove(); } catch (e) { /* already removed */ }
    if (cur === s) cur = null;
    if (error) send({ id: s.id, type: 'error', error: error });
    send({ id: s.id, type: 'end' });
  }

  async function start(c) {
    if (cur) finish(cur, 'aborted');
    var s = cur = { id: c.id, continuous: !!c.continuous, heard: false, over: false };
    try {
      if (!model) send({ id: s.id, type: 'loading' });
      await loadModel();
    } catch (e) { return finish(s, 'engine'); }
    if (s.over) return;
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch (e) { return finish(s, /NotAllowed|Permission/i.test(String(e && e.name)) ? 'not-allowed' : 'audio-capture'); }
    if (s.over) { s.stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    s.ctx = new AudioContext({ sampleRate: RATE });
    s.src = s.ctx.createMediaStreamSource(s.stream);
    s.node = s.ctx.createScriptProcessor(4096, 1, 1);
    s.rec = new model.KaldiRecognizer(RATE);
    s.rec.on('partialresult', function (m) { var t = m.result && m.result.partial; if (t) { s.heard = true; send({ id: s.id, type: 'partial', text: t }); } });
    s.rec.on('result', function (m) {
      var t = m.result && m.result.text; if (!t) return;
      s.heard = true; send({ id: s.id, type: 'final', text: t });
      if (!s.continuous) setTimeout(function () { finish(s); }, 50); // one stretch of speech, like a browser's default
    });
    s.rec.on('error', function () { finish(s, 'engine'); });
    s.node.onaudioprocess = function (e) { if (!s.over) { try { s.rec.acceptWaveform(e.inputBuffer); } catch (x) { /* a dropped chunk is fine */ } } };
    s.src.connect(s.node); s.node.connect(s.ctx.destination); // the node writes silence; connecting it is what makes it run
    send({ id: s.id, type: 'start' }); send({ id: s.id, type: 'audiostart' });
    if (!s.continuous) s.timer = setTimeout(function () { if (!s.heard) finish(s, 'no-speech'); }, NO_SPEECH_MS);
  }

  host.onCommand(function (m) {
    if (m.cmd === 'start') start(m);
    else if (m.cmd === 'abort') { if (cur && cur.id === m.id) finish(cur); }
    else if (m.cmd === 'stop') { // finish what was being said, then end
      var s = cur; if (!s || s.id !== m.id) return;
      try { s.rec.retrieveFinalResult(); } catch (e) { /* nothing to flush */ }
      setTimeout(function () { finish(s); }, 350);
    } else if (m.cmd === 'warm') loadModel().then(function () { send({ type: 'ready' }); }, function () { send({ type: 'engine-failed' }); });
  });
  send({ type: 'hello' });
})();
