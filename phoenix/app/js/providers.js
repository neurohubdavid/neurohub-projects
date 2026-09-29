// AI connections. Phoenix itself has no server and no cost: it talks to whichever AI the person chooses.
//   ollama    - runs on the person's own computer. Free and private, nothing leaves the machine.
//   openai    - any OpenAI-compatible service: Google Gemini, Groq, OpenRouter, LM Studio, and many more.
//   anthropic - Claude, with the person's own API key.
// All three stream tokens as they arrive.
import { netFetch } from './net.js';

export const PRESETS = {
  gemini: { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', note: 'Has a free tier with limits. Free-tier chats may be used by Google to improve its products, so avoid personal details.' },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', note: 'Has a free tier with limits. Very fast.' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', note: 'Lists many models, some free (look for “:free” in the name).' },
  lmstudio: { label: 'LM Studio (on this computer)', baseUrl: 'http://localhost:1234/v1', keyUrl: 'https://lmstudio.ai', note: 'Runs models on your own computer. Turn on its local server first. No key needed.' },
  custom: { label: 'Other OpenAI-compatible service', baseUrl: '', keyUrl: '', note: 'Any service that offers an OpenAI-style /chat/completions address.' },
};

let fetcher = netFetch;
export const _setFetcher = (f) => { fetcher = f || netFetch; }; // for tests

const trimSlash = (u) => String(u || '').trim().replace(/\/+$/, '');

export class AIError extends Error {
  constructor(kind, message, status) { super(message); this.kind = kind; this.status = status; }
}

/** Turns low-level failures into plain sentences a person can act on. */
function explain(cfg, status, bodyText, cause) {
  const who = cfg.kind === 'ollama' ? 'Ollama' : cfg.kind === 'anthropic' ? 'Anthropic' : 'the AI service';
  if (cause) {
    if (cfg.kind === 'ollama') return new AIError('offline', 'I could not reach Ollama. Is it running? Open the Ollama app (or run `ollama serve`), then try again.');
    return new AIError('offline', `I could not reach ${who}. Check your internet connection and the address in Settings.`);
  }
  let detail = '';
  try { const j = JSON.parse(bodyText); detail = j.error?.message || j.error || j.message || ''; if (typeof detail !== 'string') detail = JSON.stringify(detail); } catch { detail = String(bodyText || '').slice(0, 200); }
  if (status === 401 || status === 403) return new AIError('auth', `${who} did not accept the key. Check it in Settings.`, status);
  if (status === 404 && cfg.kind === 'ollama') return new AIError('model', `Ollama does not have the model “${cfg.model}”. Pick another in Settings, or run \`ollama pull ${cfg.model}\`.`, status);
  if (status === 404) return new AIError('model', `${who} could not find that model or address. Check the model name in Settings.${detail ? ' (' + detail.slice(0, 120) + ')' : ''}`, status);
  if (status === 429) return new AIError('limit', `${who} says you have used up your allowance for now. Wait a little, or pick another AI in Settings.`, status);
  if (status === 402) return new AIError('limit', `${who} says the account is out of credit. Pick another AI in Settings.`, status);
  if (status >= 500) return new AIError('server', `${who} is having trouble right now. Try again in a moment.`, status);
  return new AIError('other', `${who} returned an error (${status}).${detail ? ' ' + detail.slice(0, 160) : ''}`, status);
}

async function* lines(body, signal) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { yield buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1); }
    }
    buf += dec.decode();
    if (buf.trim()) yield buf;
  } finally { try { reader.releaseLock(); } catch { /* ignore */ } }
}

function config(state) {
  const p = state.provider;
  if (p.kind === 'ollama') return { kind: 'ollama', url: trimSlash(p.ollama.url) || 'http://localhost:11434', model: p.ollama.model };
  if (p.kind === 'openai') return { kind: 'openai', url: trimSlash(p.openai.baseUrl), key: p.openai.key, model: p.openai.model };
  if (p.kind === 'anthropic') return { kind: 'anthropic', url: 'https://api.anthropic.com', key: p.anthropic.key, model: p.anthropic.model };
  return { kind: 'offline' };
}
export { config as providerConfig };

async function request(cfg, url, init, signal) {
  let res;
  try { res = await fetcher(url, { ...init, signal }); }
  catch (e) { if (e?.name === 'AbortError') throw e; throw explain(cfg, 0, '', e); }
  if (!res.ok) { let t = ''; try { t = await res.text(); } catch { /* ignore */ } throw explain(cfg, res.status, t); }
  return res;
}

/**
 * Streams one reply. `messages` is [{role:'user'|'assistant', content}]; `system` is the system prompt.
 * Calls onText(delta) for each piece and resolves with the full reply.
 */
export async function streamChat(cfg, { system, messages, signal, onText, maxTokens = 1200 }) {
  let full = '';
  const push = (t) => { if (t) { full += t; onText?.(t, full); } };

  if (cfg.kind === 'ollama') {
    const res = await request(cfg, `${cfg.url}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cfg.model, stream: true, options: { num_predict: maxTokens }, messages: [{ role: 'system', content: system }, ...messages] }),
    }, signal);
    for await (const line of lines(res.body, signal)) {
      if (!line.trim()) continue;
      let j; try { j = JSON.parse(line); } catch { continue; }
      if (j.error) throw explain(cfg, 500, JSON.stringify({ error: j.error }));
      push(j.message?.content);
      if (j.done) break;
    }
  } else if (cfg.kind === 'openai') {
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
    const res = await request(cfg, `${cfg.url}/chat/completions`, {
      method: 'POST', headers,
      body: JSON.stringify({ model: cfg.model, stream: true, max_tokens: maxTokens, messages: [{ role: 'system', content: system }, ...messages] }),
    }, signal);
    for await (const line of lines(res.body, signal)) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') break;
      let j; try { j = JSON.parse(data); } catch { continue; }
      if (j.error) throw explain(cfg, 500, JSON.stringify({ error: j.error }));
      push(j.choices?.[0]?.delta?.content);
    }
  } else if (cfg.kind === 'anthropic') {
    const res = await request(cfg, `${cfg.url}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: cfg.model, max_tokens: maxTokens, stream: true, system, messages }),
    }, signal);
    for await (const line of lines(res.body, signal)) {
      if (!line.startsWith('data:')) continue;
      let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
      if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') push(j.delta.text);
      else if (j.type === 'error') throw explain(cfg, 500, JSON.stringify({ error: j.error }));
      else if (j.type === 'message_delta' && j.delta?.stop_reason === 'refusal') push("I can't help with that one here. If things are hard right now, the Help button shows people you can reach.");
    }
  } else {
    throw new AIError('none', 'No AI is connected.');
  }
  return full.trim();
}

/** One-shot (non-streaming from the caller's point of view) helper for tools such as the task breaker. */
export const completeOnce = (cfg, opts) => streamChat(cfg, opts);

/** Lists the models a connection offers, so the person can pick instead of typing a name. */
export async function listModels(cfg, signal) {
  if (cfg.kind === 'ollama') {
    const res = await request(cfg, `${cfg.url}/api/tags`, { method: 'GET' }, signal);
    const j = await res.json();
    return (j.models || []).map((m) => m.name).sort();
  }
  if (cfg.kind === 'openai') {
    const headers = {}; if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
    const res = await request(cfg, `${cfg.url}/models`, { method: 'GET', headers }, signal);
    const j = await res.json();
    const arr = j.data || j.models || [];
    return arr.map((m) => String(m.id || m.name || '').replace(/^models\//, '')).filter(Boolean).sort();
  }
  if (cfg.kind === 'anthropic') {
    const res = await request(cfg, `${cfg.url}/v1/models?limit=100`, { method: 'GET', headers: { 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } }, signal);
    const j = await res.json();
    return (j.data || []).map((m) => m.id);
  }
  return [];
}

/** Quick check used by the "Test connection" button. Returns {ok, message}. */
export async function testConnection(cfg) {
  try {
    const models = await listModels(cfg);
    if (cfg.model && models.length && !models.includes(cfg.model) && cfg.kind !== 'anthropic') {
      return { ok: false, message: `Connected, but “${cfg.model}” is not in the list. Pick one of the ${models.length} models offered.`, models };
    }
    const reply = await streamChat(cfg, { system: 'Reply with the single word: ready', messages: [{ role: 'user', content: 'Are you there?' }], maxTokens: 20 });
    return { ok: true, message: reply ? 'Connected. Phoenix can use this AI.' : 'Connected.', models };
  } catch (e) {
    return { ok: false, message: e.message || 'Could not connect.' };
  }
}
