// Learn: the built-in knowledge, searchable, grouped, with a "talk to Phoenix about this" button.
import { el, fmt } from './util.js';
import { KB, GROUPS } from './kb.js';
import { prefillChat } from './chat.js';

export function mountLearn(container, { navigate }) {
  container.textContent = '';
  container.classList.remove('chat-view');
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search, for example “burnout” or “stimming”', 'aria-label': 'Search topics' });
  const out = el('div', { class: 'stack' });
  const grouped = new Map(GROUPS.map(([g, ids]) => [g, ids]));
  const inGroup = new Set(GROUPS.flatMap(([, ids]) => ids));
  const other = KB.filter((e) => !inGroup.has(e.id)).map((e) => e.id);
  if (other.length) grouped.set('More', other);
  const byId = new Map(KB.map((e) => [e.id, e]));

  const item = (e) => el('details', { class: 'card learn-item' },
    el('summary', {}, e.title),
    el('div', { class: 'body stack' },
      el('p', { html: fmt(e.what) }), el('p', { html: fmt(e.why) }), el('p', { html: fmt('**What tends to help:** ' + e.helps) }),
      el('div', { class: 'row' }, el('button', { class: 'btn btn-sm', onclick: () => { navigate('chat'); prefillChat(`Can you talk with me about ${e.title.toLowerCase()}? `); } }, 'Talk to Phoenix about this'))));

  const draw = () => {
    out.textContent = '';
    const q = search.value.trim().toLowerCase();
    let any = false;
    for (const [g, ids] of grouped) {
      const list = ids.map((id) => byId.get(id)).filter(Boolean).filter((e) => !q || e.title.toLowerCase().includes(q) || e.terms.some((t) => t.includes(q)) || e.what.toLowerCase().includes(q));
      if (!list.length) continue; any = true;
      out.append(el('h2', {}, g), ...list.map(item));
    }
    if (!any) out.append(el('p', { class: 'muted' }, 'Nothing matched. Try a different word, or ask Phoenix in Chat.'));
  };
  search.addEventListener('input', draw);
  draw();
  container.append(el('div', { class: 'view-title' }, el('h1', {}, 'Learn')),
    el('p', { class: 'muted' }, 'Plain explanations, drawn from NeuroHub Community and David Gray-Hammond’s books. Some ideas are community concepts or personal views, and the text says when. This is information, not medical advice.'),
    search, out);
}
