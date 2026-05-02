import './style.css';
import { vertices, computeEdges, computeEdgeColoring } from './dodecahedron.js';

const phi = (1 + Math.sqrt(5)) / 2;

const EDGES = computeEdges();
const COLORING = computeEdgeColoring(EDGES);

/* ==========================================================
   Faces — for pentagon-completion shading
   ========================================================== */
const FACES = [
  [0, 8, 9, 1, 16],        // outer (not drawn)
  [0, 12, 14, 4, 8],
  [8, 4, 18, 5, 9],
  [9, 5, 15, 13, 1],
  [1, 13, 3, 17, 16],
  [16, 17, 2, 12, 0],
  [12, 2, 10, 6, 14],
  [14, 6, 19, 18, 4],
  [18, 19, 7, 15, 5],
  [15, 7, 11, 3, 13],
  [3, 11, 10, 2, 17],
  [6, 10, 11, 7, 19],      // inner
];

/* ==========================================================
   Schlegel layout (flatten face {0,8,9,1,16} as outer)
   ========================================================== */
function polar(deg, r) {
  const t = deg * Math.PI / 180;
  return { x: Math.sin(t) * r, y: -Math.cos(t) * r };
}
const SCHLEGEL = {};
[0, 8, 9, 1, 16].forEach((v, i)       => SCHLEGEL[v] = polar(i * 72,       1.00));
[12, 4, 5, 13, 17].forEach((v, i)     => SCHLEGEL[v] = polar(i * 72,       0.66));
[14, 18, 15, 3, 2].forEach((v, i)     => SCHLEGEL[v] = polar(i * 72 + 36,  0.40));
[6, 19, 7, 11, 10].forEach((v, i)     => SCHLEGEL[v] = polar(i * 72 + 36,  0.20));

/* ==========================================================
   State — which edges are placed
   ========================================================== */
const STORAGE_KEY = 'dodec-v1';
const state = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (Array.isArray(saved)) saved.forEach(i => state.add(i));
} catch {}


function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...state])); } catch {}
}

/* ==========================================================
   Helpers
   ========================================================== */
const SVG_NS = 'http://www.w3.org/2000/svg';
const colorClass = c => ['c-a', 'c-b', 'c-c'][c];

function countCompletedAtVertex(v) {
  let n = 0;
  EDGES.forEach(([a, b], i) => {
    if ((a === v || b === v) && state.has(i)) n++;
  });
  return n;
}

function faceEdgeIndices(face) {
  const idxs = [];
  for (let k = 0; k < face.length; k++) {
    const a = face[k], b = face[(k + 1) % face.length];
    const idx = EDGES.findIndex(([p, q]) =>
      (p === a && q === b) || (p === b && q === a));
    idxs.push(idx);
  }
  return idxs;
}

const FACE_EDGES = FACES.map((f, fi) => fi === 0 ? null : faceEdgeIndices(f));
const EDGE_FACES = EDGES.map((_, i) =>
  FACE_EDGES
    .map((idxs, fi) => (idxs && idxs.includes(i)) ? fi : -1)
    .filter(fi => fi !== -1)
);

function findSuggestedEdge() {
  if (state.size >= EDGES.length) return null;
  if (state.size === 0) return 0;

  let best = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < EDGES.length; i++) {
    if (state.has(i)) continue;
    const [u, v] = EDGES[i];
    const cu = countCompletedAtVertex(u);
    const cv = countCompletedAtVertex(v);
    const vertexScore = Math.max(cu, cv);
    const adjacency = (cu > 0 ? 1 : 0) + (cv > 0 ? 1 : 0);

    let faceFullness = 0;
    for (const fi of EDGE_FACES[i]) {
      const placed = FACE_EDGES[fi].reduce(
        (n, j) => n + (state.has(j) ? 1 : 0), 0);
      if (placed > faceFullness) faceFullness = placed;
    }

    const score = 100 * vertexScore + 10 * faceFullness + adjacency;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/* ==========================================================
   Build Schlegel SVG
   ========================================================== */
const schSvg = document.getElementById('schlegel');
const schFaceEls = [];
FACES.forEach((f, fi) => {
  if (fi === 0) { schFaceEls.push(null); return; }
  const el = document.createElementNS(SVG_NS, 'polygon');
  el.setAttribute('class', 'face');
  el.setAttribute('points', f.map(v => `${SCHLEGEL[v].x},${SCHLEGEL[v].y}`).join(' '));
  schSvg.appendChild(el);
  schFaceEls.push(el);
});

const schEdgeEls = [];
EDGES.forEach(([a, b], i) => {
  const p1 = SCHLEGEL[a], p2 = SCHLEGEL[b];
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('class', `edge ${colorClass(COLORING[i])}`);
  el.setAttribute('x1', p1.x); el.setAttribute('y1', p1.y);
  el.setAttribute('x2', p2.x); el.setAttribute('y2', p2.y);
  el.dataset.edge = i;
  schSvg.appendChild(el);
  schEdgeEls.push(el);
});

const schVertexEls = {};
Object.keys(SCHLEGEL).forEach(v => {
  const { x, y } = SCHLEGEL[v];
  const el = document.createElementNS(SVG_NS, 'circle');
  el.setAttribute('class', 'vertex');
  el.setAttribute('cx', x); el.setAttribute('cy', y);
  el.setAttribute('r', 0.026);
  schSvg.appendChild(el);
  schVertexEls[v] = el;
});

/* ==========================================================
   Build 3D SVG (orthographic projection + drag)
   ========================================================== */
const threeSvg = document.getElementById('three');

const threeEdgeEls = EDGES.map(([a, b], i) => {
  const el = document.createElementNS(SVG_NS, 'line');
  el.setAttribute('class', `edge ${colorClass(COLORING[i])}`);
  el.dataset.edge = i;
  threeSvg.appendChild(el);
  return el;
});
const threeVertexEls = vertices.map(() => {
  const el = document.createElementNS(SVG_NS, 'circle');
  el.setAttribute('class', 'vertex');
  threeSvg.appendChild(el);
  return el;
});

/* 3×3 rotation matrix utilities — trackball rotation */
function matMul(A, B) {
  const C = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        C[i][j] += A[i][k] * B[k][j];
  return C;
}
function matApply(M, v) {
  return [
    M[0][0]*v[0] + M[0][1]*v[1] + M[0][2]*v[2],
    M[1][0]*v[0] + M[1][1]*v[1] + M[1][2]*v[2],
    M[2][0]*v[0] + M[2][1]*v[1] + M[2][2]*v[2],
  ];
}
function axisAngle(ax, ay, az, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    [t*ax*ax + c,     t*ax*ay - s*az,  t*ax*az + s*ay],
    [t*ax*ay + s*az,  t*ay*ay + c,     t*ay*az - s*ax],
    [t*ax*az - s*ay,  t*ay*az + s*ax,  t*az*az + c  ],
  ];
}

const view = {
  M: matMul(axisAngle(1, 0, 0, 0.35), axisAngle(0, 1, 0, 0.6)),
};

function project(v3d) {
  const [x, y, z] = matApply(view.M, v3d);
  const s = 1.3;
  return { x: x * s, y: -y * s, z };
}

function renderThree() {
  const proj = vertices.map(project);

  const order = EDGES.map(([a, b], i) => ({
    i, z: (proj[a].z + proj[b].z) * 0.5,
  })).sort((A, B) => A.z - B.z);

  order.forEach(({ i }) => {
    const el = threeEdgeEls[i];
    threeSvg.appendChild(el);
    const [a, b] = EDGES[i];
    el.setAttribute('x1', proj[a].x);
    el.setAttribute('y1', proj[a].y);
    el.setAttribute('x2', proj[b].x);
    el.setAttribute('y2', proj[b].y);
  });

  threeVertexEls.forEach((el, i) => {
    threeSvg.appendChild(el);
    el.setAttribute('cx', proj[i].x);
    el.setAttribute('cy', proj[i].y);
    el.setAttribute('r', 0.052);
  });
}

/* ==========================================================
   Animation + drag
   ========================================================== */
let suggestedEdge = null;
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  renderThree();
  if (suggestedEdge != null) {
    const phase = (Math.sin(now * 2 * Math.PI / 1400) + 1) / 2;
    const opacity = 0.18 + (0.55 - 0.18) * phase;
    schEdgeEls[suggestedEdge].style.opacity = opacity;
    threeEdgeEls[suggestedEdge].style.opacity = opacity;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

let drag = null;
threeSvg.addEventListener('pointerdown', (e) => {
  drag = { lastX: e.clientX, lastY: e.clientY };
  threeSvg.setPointerCapture(e.pointerId);
});
threeSvg.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.lastX;
  const dy = e.clientY - drag.lastY;
  drag.lastX = e.clientX;
  drag.lastY = e.clientY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.5) return;
  const ax = dy / len;
  const ay = dx / len;
  const angle = len * 0.008;
  const R = axisAngle(ax, ay, 0, angle);
  view.M = matMul(R, view.M);
});
function endDrag(e) {
  if (!drag) return;
  drag = null;
  try { threeSvg.releasePointerCapture(e.pointerId); } catch {}
}
threeSvg.addEventListener('pointerup', endDrag);
threeSvg.addEventListener('pointercancel', endDrag);

/* ==========================================================
   Sync state → visuals
   ========================================================== */
let hoveredEdge = null;

function syncEdgeState() {
  const next = guideOn ? findSuggestedEdge() : null;
  if (suggestedEdge != null && suggestedEdge !== next) {
    schEdgeEls[suggestedEdge].style.opacity = '';
    threeEdgeEls[suggestedEdge].style.opacity = '';
  }
  suggestedEdge = next;
  schEdgeEls.forEach((el, i) => {
    const done = state.has(i);
    el.classList.toggle('state-done', done);
    el.classList.toggle('state-empty', !done);
    el.classList.toggle('state-suggested', i === suggestedEdge);
    if (i === hoveredEdge && !done) el.classList.add('state-hover');
    else el.classList.remove('state-hover');
  });
  threeEdgeEls.forEach((el, i) => {
    const done = state.has(i);
    el.classList.toggle('state-done', done);
    el.classList.toggle('state-empty', !done);
    el.classList.toggle('state-suggested', i === suggestedEdge);
    el.classList.toggle('state-hover', i === hoveredEdge);
  });
}

function syncVertexState() {
  Object.entries(schVertexEls).forEach(([v, el]) => {
    const locked = countCompletedAtVertex(+v) === 3;
    el.classList.toggle('is-locked', locked);
  });
  threeVertexEls.forEach((el, i) => {
    const locked = countCompletedAtVertex(i) === 3;
    el.classList.toggle('is-locked', locked);
  });
}

function syncFaceState() {
  FACES.forEach((f, fi) => {
    if (fi === 0) return;
    const idxs = faceEdgeIndices(f);
    schFaceEls[fi].classList.toggle('is-complete',
      idxs.every(i => state.has(i)));
  });
}

function syncProgress() {
  const byColor = [0, 0, 0];
  state.forEach(i => byColor[COLORING[i]]++);
  document.getElementById('count-done').textContent = state.size;
  const bar = document.getElementById('progress-bar');
  [0, 1, 2].forEach(c => {
    bar.children[c].style.width = `${(byColor[c] / 30) * 100}%`;
  });
  document.querySelectorAll('#progress-breakdown [data-color]').forEach(el => {
    const c = +el.dataset.color;
    el.textContent = `${byColor[c]}/10`;
  });
}

function render() {
  syncEdgeState();
  syncVertexState();
  syncFaceState();
  syncProgress();
}

/* ==========================================================
   Interaction on Schlegel edges (hover + click)
   ========================================================== */
schEdgeEls.forEach(el => {
  el.addEventListener('pointerenter', () => {
    hoveredEdge = +el.dataset.edge;
    syncEdgeState();
  });
  el.addEventListener('pointerleave', () => {
    hoveredEdge = null;
    syncEdgeState();
  });
  el.addEventListener('click', () => {
    const i = +el.dataset.edge;
    if (state.has(i)) state.delete(i); else state.add(i);
    saveState();
    render();
  });
});

/* ==========================================================
   Controls
   ========================================================== */
const guideBtn = document.getElementById('btn-guide');
const GUIDE_STORAGE_KEY = 'dodec-guide';
let guideOn = localStorage.getItem(GUIDE_STORAGE_KEY) === '1';

function applyGuideButton() {
  guideBtn.classList.toggle('is-active', guideOn);
  guideBtn.textContent = guideOn ? 'Guide on' : 'Guide';
}
applyGuideButton();

guideBtn.addEventListener('click', () => {
  guideOn = !guideOn;
  localStorage.setItem(GUIDE_STORAGE_KEY, guideOn ? '1' : '0');
  applyGuideButton();
  render();
});

/* ==========================================================
   Color customization
   ========================================================== */
const COLOR_STORAGE_KEY = 'dodec-colors';
const SLOTS = ['a', 'b', 'c'];

function applyColorOverrides(hexes) {
  hexes.forEach((hex, i) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const root = document.documentElement.style;
    root.setProperty(`--c-${SLOTS[i]}`, hex);
    root.setProperty(`--c-${SLOTS[i]}-dim`, `rgba(${r}, ${g}, ${b}, 0.18)`);
    root.setProperty(`--glow-${SLOTS[i]}`, `0 0 6px rgba(${r}, ${g}, ${b}, 0.55)`);
  });
}

function clearColorOverrides() {
  const root = document.documentElement.style;
  SLOTS.forEach(s => {
    root.removeProperty(`--c-${s}`);
    root.removeProperty(`--c-${s}-dim`);
    root.removeProperty(`--glow-${s}`);
  });
}

(function loadColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === 3) applyColorOverrides(saved);
  } catch {}
})();

function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  if (!m || m.length < 3) return '#000000';
  return '#' + m.slice(0, 3)
    .map(n => parseInt(n).toString(16).padStart(2, '0'))
    .join('');
}

function currentHex(slot) {
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(`--c-${slot}`).trim();
  return v.startsWith('#') ? v : rgbToHex(v);
}

function readSavedColors() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLOR_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length === 3) return saved;
  } catch {}
  return SLOTS.map(currentHex);
}

const dotInputs = [];
document.querySelectorAll('.bd-dot').forEach((dot, i) => {
  dot.style.position = 'relative';
  dot.style.cursor = 'pointer';
  dot.title = 'Click to change color';
  const input = document.createElement('input');
  input.type = 'color';
  input.value = currentHex(SLOTS[i]);
  input.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;' +
    'opacity:0;cursor:pointer;border:none;padding:0;background:none;';
  input.addEventListener('input', (e) => {
    const next = readSavedColors();
    next[i] = e.target.value;
    applyColorOverrides(next);
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(next));
  });
  dot.appendChild(input);
  dotInputs.push(input);
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.clear();
  saveState();
  clearColorOverrides();
  localStorage.removeItem(COLOR_STORAGE_KEY);
  dotInputs.forEach((input, i) => { input.value = currentHex(SLOTS[i]); });
  render();
});

/* ==========================================================
   Theme toggle
   ========================================================== */
const themeBtn = document.getElementById('theme-toggle');

function isDark() {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'dark' || (!attr && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function updateThemeIcon() {
  themeBtn.textContent = isDark() ? '\u263C' : '\u263E';
}

themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('dodec-theme', next);
  updateThemeIcon();
});

updateThemeIcon();

/* ==========================================================
   Splash modal — first-load tour, replayable via Tour button
   ========================================================== */
const SPLASH_KEY = 'dodec-splash-seen';
const SPLASH_STEPS = [
  {
    title: 'Welcome',
    body: `<p>An assembly tracker for 30-unit modular origami dodecahedra with a proper 3-edge coloring.</p>
           <img src="/schlegel-hero.svg" alt="3-edge colored dodecahedron" class="splash-hero" />`,
  },
  {
    title: 'Mark edges as you build',
    body: `<p>Click any edge in the Schlegel panel on the left to mark it as placed. Click again to undo.</p>`,
  },
  {
    title: '3D preview',
    body: `<p>The same model from any angle. Drag the right panel to rotate it as a reference while you fold.</p>`,
  },
  {
    title: 'Guide',
    body: `<p>Toggle <strong>Guide</strong> to highlight the next edge to fold. Suggestions prioritize closing open vertices, then completing faces.</p>`,
  },
  {
    title: 'Custom colors',
    body: `<p>Tap any of the three legend dots in the footer to match the actual paper colors of your build.</p>`,
  },
];

const splashEl = document.getElementById('splash');
const splashStepEl = document.getElementById('splash-step');
const splashProgressEl = document.getElementById('splash-progress');
const splashPrevBtn = document.getElementById('splash-prev');
const splashNextBtn = document.getElementById('splash-next');
const splashSkipBtn = document.getElementById('splash-skip');
const tourBtn = document.getElementById('btn-tour');

let splashIdx = 0;
function renderSplashStep() {
  const step = SPLASH_STEPS[splashIdx];
  splashStepEl.innerHTML = `<h2>${step.title}</h2>${step.body}`;
  splashProgressEl.textContent = `${splashIdx + 1} / ${SPLASH_STEPS.length}`;
  splashPrevBtn.disabled = splashIdx === 0;
  splashNextBtn.textContent = splashIdx === SPLASH_STEPS.length - 1 ? 'Get started' : 'Next';
}
function openSplash() {
  splashIdx = 0;
  splashEl.hidden = false;
  renderSplashStep();
}
function closeSplash() {
  splashEl.hidden = true;
  localStorage.setItem(SPLASH_KEY, '1');
}
splashNextBtn.addEventListener('click', () => {
  if (splashIdx < SPLASH_STEPS.length - 1) {
    splashIdx++;
    renderSplashStep();
  } else {
    closeSplash();
  }
});
splashPrevBtn.addEventListener('click', () => {
  if (splashIdx > 0) { splashIdx--; renderSplashStep(); }
});
splashSkipBtn.addEventListener('click', closeSplash);
tourBtn.addEventListener('click', openSplash);
document.addEventListener('keydown', (e) => {
  if (splashEl.hidden) return;
  if (e.key === 'Escape') closeSplash();
  else if (e.key === 'ArrowRight') splashNextBtn.click();
  else if (e.key === 'ArrowLeft' && splashIdx > 0) splashPrevBtn.click();
});

if (!localStorage.getItem(SPLASH_KEY)) openSplash();

// Initial paint
render();
