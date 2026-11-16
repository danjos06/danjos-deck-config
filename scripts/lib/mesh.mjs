// Mesh helpers for the 3MF -> GLB pipeline: welding, affine remap, crease-angle normals.

/** Merges coincident vertices (quantised to `eps` mm). Drops degenerate triangles. */
export function weld(positions, indices, eps = 1e-4) {
  const map = new Map();
  const out = [];
  const remap = new Uint32Array(positions.length / 3);
  for (let i = 0; i < positions.length / 3; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const key = `${Math.round(x / eps)},${Math.round(y / eps)},${Math.round(z / eps)}`;
    let id = map.get(key);
    if (id === undefined) {
      id = out.length / 3;
      map.set(key, id);
      out.push(x, y, z);
    }
    remap[i] = id;
  }
  const idx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = remap[indices[t]];
    const b = remap[indices[t + 1]];
    const c = remap[indices[t + 2]];
    if (a !== b && b !== c && a !== c) idx.push(a, b, c);
  }
  return { positions: Float64Array.from(out), indices: Uint32Array.from(idx) };
}

/** Concatenates several {positions, indices} meshes. */
export function concat(meshes) {
  let vc = 0;
  const pos = [];
  const idx = [];
  for (const m of meshes) {
    for (const v of m.positions) pos.push(v);
    for (const i of m.indices) idx.push(i + vc);
    vc += m.positions.length / 3;
  }
  return { positions: Float64Array.from(pos), indices: Uint32Array.from(idx) };
}

/** Applies fn(x,y,z) -> [x,y,z] to every vertex. Flips winding if `mirror`. */
export function mapVertices(mesh, fn, mirror = false) {
  const p = new Float64Array(mesh.positions.length);
  for (let i = 0; i < p.length; i += 3) {
    const r = fn(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
    p[i] = r[0];
    p[i + 1] = r[1];
    p[i + 2] = r[2];
  }
  const idx = Uint32Array.from(mesh.indices);
  if (mirror) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  return { positions: p, indices: idx };
}

export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], positions[i + k]);
      max[k] = Math.max(max[k], positions[i + k]);
    }
  }
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

/**
 * Splits vertices along creases sharper than `creaseDeg` and returns non-indexed-safe
 * indexed arrays with area-weighted smooth normals inside each smoothing group.
 * Keeps CAD flats crisp while cylinders and fillets shade smoothly.
 */
export function creaseNormals(mesh, creaseDeg = 35) {
  const { positions: P, indices: I } = mesh;
  const triCount = I.length / 3;
  const fn = new Float64Array(triCount * 3); // area-weighted face normals
  for (let t = 0; t < triCount; t++) {
    const a = I[t * 3] * 3;
    const b = I[t * 3 + 1] * 3;
    const c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    fn[t * 3] = uy * vz - uz * vy;
    fn[t * 3 + 1] = uz * vx - ux * vz;
    fn[t * 3 + 2] = ux * vy - uy * vx;
  }
  const unit = (t) => {
    const x = fn[t * 3], y = fn[t * 3 + 1], z = fn[t * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  const vertTris = Array.from({ length: P.length / 3 }, () => []);
  for (let t = 0; t < triCount; t++) for (let k = 0; k < 3; k++) vertTris[I[t * 3 + k]].push(t);

  const cosLimit = Math.cos((creaseDeg * Math.PI) / 180);
  const outPos = [];
  const outNrm = [];
  const outIdx = new Uint32Array(I.length);
  for (let v = 0; v < vertTris.length; v++) {
    const tris = vertTris[v];
    const groups = []; // { ref: unit normal of seed, sum: [x,y,z], tris: [] }
    for (const t of tris) {
      const n = unit(t);
      let g = groups.find((gr) => gr.ref[0] * n[0] + gr.ref[1] * n[1] + gr.ref[2] * n[2] >= cosLimit);
      if (!g) {
        g = { ref: n, sum: [0, 0, 0], tris: [] };
        groups.push(g);
      }
      g.sum[0] += fn[t * 3];
      g.sum[1] += fn[t * 3 + 1];
      g.sum[2] += fn[t * 3 + 2];
      g.tris.push(t);
    }
    for (const g of groups) {
      const id = outPos.length / 3;
      outPos.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      const l = Math.hypot(...g.sum) || 1;
      outNrm.push(g.sum[0] / l, g.sum[1] / l, g.sum[2] / l);
      for (const t of g.tris) for (let k = 0; k < 3; k++) if (I[t * 3 + k] === v) outIdx[t * 3 + k] = id;
    }
  }
  return { positions: Float32Array.from(outPos), normals: Float32Array.from(outNrm), indices: outIdx };
}
