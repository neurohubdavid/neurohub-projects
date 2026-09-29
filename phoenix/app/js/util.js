// Small DOM + text helpers. No dependencies.

export const $ = (sel, root = document) => root.querySelector(sel);

/** Create an element: el('div', {class:'x', onclick}, child, 'text', ...) */
export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'value') node.value = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Markdown-lite: **bold**, *italic*, `code`, [label](https://url), bare https URLs, "- " bullets, newlines. Everything else is escaped. */
export function fmt(str) {
  let s = esc(str);
  s = s.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  s = s.replace(/(^|[\s(>])(https:\/\/[^\s<)]+[^\s<).,;:!?])/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/^(?:[-•*] )(.+)$/gm, '<span class="li">$1</span>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

/** Plain text (no markdown) for speech and copying. */
export function plain(str) {
  return String(str ?? '')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtDate = (ts, opts) => new Date(ts).toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** Tiny pub/sub */
export function emitter() {
  const map = new Map();
  return {
    on(evt, fn) { (map.get(evt) || map.set(evt, new Set()).get(evt)).add(fn); return () => map.get(evt)?.delete(fn); },
    emit(evt, data) { (map.get(evt) || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
  };
}
export const bus = emitter();

export function prefersReducedMotion() {
  return document.documentElement.dataset.motion === 'reduced' ||
    (document.documentElement.dataset.motion !== 'full' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Announce to screen readers */
export function announce(msg) {
  let r = document.getElementById('live-region');
  if (!r) { r = el('div', { id: 'live-region', class: 'sr-only', 'aria-live': 'polite', role: 'status' }); document.body.append(r); }
  r.textContent = '';
  setTimeout(() => { r.textContent = msg; }, 30);
}

export function toast(msg, opts = {}) {
  let host = document.getElementById('toasts');
  if (!host) { host = el('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
  const t = el('div', { class: 'toast ' + (opts.kind || '') }, opts.icon ? el('span', { 'aria-hidden': 'true' }, opts.icon) : null, el('span', { html: fmt(msg) }));
  host.append(t);
  setTimeout(() => t.classList.add('out'), opts.ms || 2800);
  setTimeout(() => t.remove(), (opts.ms || 2800) + 400);
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prevFocus = document.activeElement;
  const overlay = el('div', { class: 'modal-overlay', role: 'presentation' });
  const titleId = 'modal-title-' + uid();
  const box = el('div', { class: 'modal card' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId });
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    overlay.remove(); document.removeEventListener('keydown', onKey); prevFocus?.focus?.(); onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const head = el('div', { class: 'modal-head' }, el('h2', { id: titleId }, title || ''), el('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Close', onclick: close }, '✕'));
  const foot = actions.length ? el('div', { class: 'modal-foot' }, actions.map((a) => el('button', { class: 'btn ' + (a.class || ''), onclick: () => { if (a.onclick?.(close) !== false && !a.keepOpen) close(); } }, a.label))) : null;
  box.append(head, el('div', { class: 'modal-body' }, body), foot);
  overlay.append(box);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  (box.querySelector('[autofocus]') || box.querySelector('button, input, select, textarea, a') || box).focus();
  return { close, box, overlay };
}

/** Copy text to the clipboard, with a fallback for browsers that block the async API. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  try {
    const t = el('textarea', { style: { position: 'fixed', opacity: '0' } }); t.value = text; document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  } catch { return false; }
}

export function download(filename, text, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
  const a = el('a', { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
