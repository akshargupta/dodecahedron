/**
 * Dodecahedron geometry: vertices, edges, and 3-edge coloring.
 *
 * Vertices use the standard golden-ratio construction.
 * Edges are pairs of vertices at distance 2/phi apart.
 * The 3-edge coloring is computed via backtracking — guaranteed to exist
 * because the dodecahedron graph is 3-regular and class 1 (Vizing).
 */

const phi = (1 + Math.sqrt(5)) / 2;
const invPhi = 1 / phi;

// 20 vertices of a regular dodecahedron
export const vertices = [
  // 8 cube vertices
  [ 1,  1,  1],  //  0
  [ 1,  1, -1],  //  1
  [ 1, -1,  1],  //  2
  [ 1, -1, -1],  //  3
  [-1,  1,  1],  //  4
  [-1,  1, -1],  //  5
  [-1, -1,  1],  //  6
  [-1, -1, -1],  //  7
  // 4 vertices on the yz-rectangle
  [ 0,  phi,  invPhi],  //  8
  [ 0,  phi, -invPhi],  //  9
  [ 0, -phi,  invPhi],  // 10
  [ 0, -phi, -invPhi],  // 11
  // 4 vertices on the xz-rectangle
  [ invPhi,  0,  phi],  // 12
  [ invPhi,  0, -phi],  // 13
  [-invPhi,  0,  phi],  // 14
  [-invPhi,  0, -phi],  // 15
  // 4 vertices on the xy-rectangle
  [ phi,  invPhi,  0],  // 16
  [ phi, -invPhi,  0],  // 17
  [-phi,  invPhi,  0],  // 18
  [-phi, -invPhi,  0],  // 19
];

/**
 * Compute the 30 edges of the dodecahedron.
 * Two vertices are adjacent iff their squared distance equals 4/phi^2.
 */
export function computeEdges() {
  const edges = [];
  const targetDistSq = 4 / (phi * phi);

  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const dx = vertices[i][0] - vertices[j][0];
      const dy = vertices[i][1] - vertices[j][1];
      const dz = vertices[i][2] - vertices[j][2];
      const distSq = dx * dx + dy * dy + dz * dz;
      if (Math.abs(distSq - targetDistSq) < 0.001) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

/**
 * Compute a proper 3-edge coloring via backtracking.
 * Returns an array of length edges.length, each value in {0, 1, 2}.
 */
export function computeEdgeColoring(edges) {
  const colors = new Array(edges.length).fill(-1);

  // Precompute: for each edge, which other edges share a vertex
  const conflicts = edges.map(([u, v], idx) => {
    const neighbors = [];
    for (let i = 0; i < edges.length; i++) {
      if (i === idx) continue;
      const [a, b] = edges[i];
      if (a === u || b === u || a === v || b === v) {
        neighbors.push(i);
      }
    }
    return neighbors;
  });

  function solve(idx) {
    if (idx === edges.length) return true;

    const used = new Set();
    for (const neighbor of conflicts[idx]) {
      if (colors[neighbor] !== -1) used.add(colors[neighbor]);
    }

    for (let c = 0; c < 3; c++) {
      if (!used.has(c)) {
        colors[idx] = c;
        if (solve(idx + 1)) return true;
        colors[idx] = -1;
      }
    }
    return false;
  }

  solve(0);
  return colors;
}
