// Network access. In the desktop app, requests go through the app's main process (see electron/main.cjs), which
// avoids browser cross-origin limits so Phoenix can talk to a local Ollama or an online AI service. In a plain
// browser, the normal fetch is used (and the service must allow cross-origin requests).
export function netFetch(url, init = {}) {
  const native = globalThis.phoenixNative;
  if (!native?.request) return fetch(url, init);

  const { signal, ...rest } = init;
  return new Promise((resolve, reject) => {
    let controller, id = null, settled = false;
    const stream = new ReadableStream({
      start(c) { controller = c; },
      cancel() { if (id != null) native.abort(id); },
    });
    const onAbort = () => {
      if (id != null) native.abort(id);
      const err = new DOMException('Aborted', 'AbortError');
      if (!settled) { settled = true; reject(err); } else { try { controller.error(err); } catch { /* already closed */ } }
    };
    if (signal) {
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', onAbort, { once: true });
    }
    native.request({ url, method: rest.method || 'GET', headers: rest.headers || {}, body: rest.body ?? null }, (ev) => {
      if (ev.type === 'head') {
        settled = true;
        resolve(new Response(ev.status === 204 || ev.status === 304 ? null : stream, { status: ev.status, statusText: ev.statusText, headers: ev.headers }));
      } else if (ev.type === 'chunk') {
        try { controller.enqueue(ev.data); } catch { /* stream cancelled */ }
      } else if (ev.type === 'end') {
        try { controller.close(); } catch { /* ignore */ }
      } else if (ev.type === 'error') {
        if (!settled) { settled = true; reject(new TypeError(ev.message || 'Network error')); }
        else { try { controller.error(new TypeError(ev.message)); } catch { /* ignore */ } }
      }
    }).then((rid) => { id = rid; if (signal?.aborted) native.abort(rid); });
  });
}
