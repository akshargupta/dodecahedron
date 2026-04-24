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
let lastT = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  renderThree();
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
  schEdgeEls.forEach((el, i) => {
    const done = state.has(i);
    el.classList.toggle('state-done', done);
    el.classList.toggle('state-empty', !done);
    if (i === hoveredEdge && !done) el.classList.add('state-hover');
    else el.classList.remove('state-hover');
  });
  threeEdgeEls.forEach((el, i) => {
    const done = state.has(i);
    el.classList.toggle('state-done', done);
    el.classList.toggle('state-empty', !done);
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
let guideOn = false;
guideBtn.addEventListener('click', () => {
  guideOn = !guideOn;
  guideBtn.classList.toggle('is-active', guideOn);
  guideBtn.textContent = guideOn ? 'Guide on' : 'Guide';
});

document.getElementById('btn-reset').addEventListener('click', () => {
  state.clear();
  saveState();
  render();
});

// Initial paint
render();
