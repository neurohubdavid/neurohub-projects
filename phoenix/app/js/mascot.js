// Phoenix mascot: an inline SVG whose animation state is driven by a data-state attribute.
// Drawn to match the NeuroHub Community phoenix logo: a raptor seen side-on, hooked beak, swept crest,
// wide fanned wings (purple, pink, yellow, green) and a long flowing tail. The NeuroHub Community phoenix.
let counter = 0;

const INK = '#16121f';
const P = (n) => n.toFixed(1);

// One tapered, gently curved feather from the shoulder S at `deg` (y points down) for `len`, `w` wide.
function feather(sx, sy, deg, len, w, fill) {
  const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const tx = sx + dx * len + nx * -5, ty = sy + dy * len + ny * -5; // tip, bent slightly upward
  const mx = sx + dx * len * 0.55, my = sy + dy * len * 0.55;
  const b1 = [sx + nx * 6, sy + ny * 6], b2 = [sx - nx * 6, sy - ny * 6];
  const c1 = [mx + nx * w, my + ny * w], c2 = [mx - nx * w, my - ny * w];
  return `<path d="M${P(b1[0])} ${P(b1[1])} Q${P(c1[0])} ${P(c1[1])} ${P(tx)} ${P(ty)} Q${P(c2[0])} ${P(c2[1])} ${P(b2[0])} ${P(b2[1])}Z" fill="${fill}"/>`;
}

// The left wing, drawn back to front. The right wing is this mirrored.
function wingFeathers() {
  const S = [82, 116];
  const out = [
    feather(S[0], S[1], 200, 84, 11, '#7b2cbf'),
    feather(S[0], S[1], 214, 92, 11, '#d63a9a'),
    feather(S[0], S[1], 228, 98, 11, '#7b2cbf'),
    feather(S[0], S[1], 242, 100, 11, '#ff2e7e'),
    feather(S[0], S[1], 256, 92, 10, '#7b2cbf'),
    // inner coverts
    feather(S[0], S[1], 205, 48, 9, '#3fbf8a'),
    feather(S[0], S[1], 219, 58, 10, '#ffd23a'),
    feather(S[0], S[1], 233, 62, 10, '#ffe066'),
    feather(S[0], S[1], 247, 54, 9, '#ffd23a'),
  ];
  return out.join('');
}

export function phoenixSVG(level = 1) {
  const id = 'ph' + ++counter;
  const wrap = document.createElement('span');
  wrap.className = 'ph';
  wrap.dataset.state = 'idle';
  wrap.dataset.level = String(Math.min(7, Math.max(1, level)));
  const wing = wingFeathers();
  wrap.innerHTML = `
<svg class="ph-svg" viewBox="0 0 200 212" role="img" aria-label="Phoenix, your AI assistant" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb347"/><stop offset=".6" stop-color="#ff7a2e"/><stop offset="1" stop-color="#ff4d6d"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff8a2a"/><stop offset=".55" stop-color="#ff4d7d"/><stop offset="1" stop-color="#ff2e7e"/></linearGradient>
    <linearGradient id="${id}c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff6a3d"/><stop offset=".6" stop-color="#ffc94a"/><stop offset="1" stop-color="#b8f557"/></linearGradient>
  </defs>
  <circle class="ph-aura" cx="100" cy="112" r="92" fill="none" stroke="#b8f557" stroke-width="5"/>
  <g class="ph-all">
    <g class="ph-tail" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
      <path d="M92 138 C72 158 62 186 46 209 C78 198 98 172 100 146Z" fill="#7b2cbf"/>
      <path d="M108 138 C128 158 140 184 154 207 C126 197 106 172 100 146Z" fill="#ffd23a"/>
      <path d="M97 140 C88 168 92 194 106 211 C112 190 108 164 103 140Z" fill="#ff2e7e"/>
      <path d="M90 140 C82 160 84 182 92 200 C100 184 102 162 98 142Z" fill="#ff8a2a"/>
      <path d="M110 140 C116 160 114 182 108 200 C102 184 100 162 102 142Z" fill="#3fbf8a"/>
    </g>
    <g class="ph-wing ph-wing-l" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">${wing}</g>
    <g class="ph-wing ph-wing-r" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"><g transform="translate(200 0) scale(-1 1)">${wing}</g></g>
    <path d="M88 74 C81 98 84 126 93 146 L107 146 C116 126 119 98 112 74 C107 68 93 68 88 74Z" fill="url(#${id}b)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="M97 82 C110 98 92 120 104 140" fill="none" stroke="#3fbf8a" stroke-width="5" stroke-linecap="round"/>
    <path d="M104 80 C92 98 108 122 96 142" fill="none" stroke="#ffd23a" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>
    <g class="ph-infinity" transform="translate(100 108)" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M0 0 C3 -7 13 -7 13 0 C13 7 3 7 0 0 C-3 -7 -13 -7 -13 0 C-13 7 -3 7 0 0Z" stroke="${INK}" stroke-width="5.4"/>
      <path d="M0 0 C3 -7 13 -7 13 0 C13 7 3 7 0 0 C-3 -7 -13 -7 -13 0 C-13 7 -3 7 0 0Z" stroke="#f7c531" stroke-width="3"/>
    </g>
    <g class="ph-crest" stroke="${INK}" stroke-width="2.3" stroke-linejoin="round" fill="url(#${id}c)">
      <path d="M112 42 C120 30 130 24 142 24 C133 31 126 40 121 52Z"/>
      <path d="M116 50 C126 42 137 40 148 43 C138 47 130 53 124 62Z"/>
      <path d="M110 36 C113 24 121 14 131 10 C126 19 123 29 121 42Z"/>
    </g>
    <path d="M89 47 C91 33 108 30 117 40 C124 49 120 66 110 74 L96 76 C90 71 87 60 89 47Z" fill="url(#${id}h)" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    <ellipse cx="108" cy="64" rx="6.5" ry="4.5" fill="#ff9ec7" opacity=".6"/>
    <g class="ph-beak" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round">
      <path class="ph-lower" d="M91 64 L76 68 C80 75 88 76 93 72Z" fill="#f5a623"/>
      <path d="M92 46 C79 46 68 55 66 68 C65 74 68 76 71 74 C71 69 79 64 92 64Z" fill="#ffc94a"/>
    </g>
    <g class="ph-eyes">
      <circle cx="101" cy="54" r="7.4" fill="#fff" stroke="${INK}" stroke-width="2.3"/>
      <g class="ph-pupil"><circle cx="99" cy="55" r="4" fill="${INK}"/><circle cx="97.8" cy="53.4" r="1.4" fill="#fff"/></g>
      <circle class="ph-lid" cx="101" cy="54" r="8" fill="url(#${id}h)"/>
      <path d="M92 45 Q101 41 109 46" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </g>
    <g class="ph-think-dots" fill="${INK}"><circle cx="146" cy="18" r="3.5"/><circle cx="158" cy="12" r="4.5"/><circle cx="172" cy="4" r="5.5"/></g>
    <g fill="#ffc94a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round">
      <path class="ph-spark" transform="translate(14 22)" d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3Z"/>
      <path class="ph-spark" transform="translate(188 24)" d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3Z"/>
      <path class="ph-spark" transform="translate(10 92)" d="M0 -8 L2.4 -2.4 L8 0 L2.4 2.4 L0 8 L-2.4 2.4 L-8 0 L-2.4 -2.4Z"/>
    </g>
  </g></svg>`;
  return wrap;
}

export function setPhoenixState(node, state) {
  if (node) node.dataset.state = state;
}

