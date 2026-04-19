import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { vertices, computeEdges, computeEdgeColoring } from './dodecahedron.js';
import './style.css';

// --- Scene setup ---

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(3, 2, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// --- Lighting ---

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 5, 5);
scene.add(dirLight);

// --- Edge colors ---

const COLORS = [
  { hex: 0xe74c3c, name: 'Color A' }, // red
  { hex: 0x2ecc71, name: 'Color B' }, // green
  { hex: 0x3498db, name: 'Color C' }, // blue
];

// --- Build dodecahedron ---

const edges = computeEdges();
const coloring = computeEdgeColoring(edges);

const dodecahedronGroup = new THREE.Group();
scene.add(dodecahedronGroup);

// Shared geometries
const sphereGeo = new THREE.SphereGeometry(0.06, 16, 16);
const vertexMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

// Edge cylinders
const edgeRadius = 0.035;
const up = new THREE.Vector3(0, 1, 0);

edges.forEach(([i, j], idx) => {
  const start = new THREE.Vector3(...vertices[i]);
  const end = new THREE.Vector3(...vertices[j]);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const length = start.distanceTo(end);
  const direction = new THREE.Vector3().subVectors(end, start).normalize();

  const geo = new THREE.CylinderGeometry(edgeRadius, edgeRadius, length, 8);
  const mat = new THREE.MeshStandardMaterial({ color: COLORS[coloring[idx]].hex });
  const cylinder = new THREE.Mesh(geo, mat);

  cylinder.position.copy(mid);
  cylinder.quaternion.setFromUnitVectors(up, direction);
  dodecahedronGroup.add(cylinder);
});

// Vertex spheres
vertices.forEach((v) => {
  const sphere = new THREE.Mesh(sphereGeo, vertexMat);
  sphere.position.set(...v);
  dodecahedronGroup.add(sphere);
});

// --- Legend ---

const legend = document.createElement('div');
legend.id = 'legend';
COLORS.forEach((c) => {
  const item = document.createElement('div');
  item.className = 'legend-item';

  const swatch = document.createElement('div');
  swatch.className = 'legend-swatch';
  swatch.style.background = '#' + c.hex.toString(16).padStart(6, '0');

  const label = document.createElement('span');
  label.textContent = c.name;

  item.appendChild(swatch);
  item.appendChild(label);
  legend.appendChild(item);
});
document.body.appendChild(legend);

// --- Animate ---

function animate() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

// --- Resize ---

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
