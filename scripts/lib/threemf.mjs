// Minimal 3MF reader: core + production extension (p:path components), affine transforms.
import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';

/** 3MF affine: 12 numbers, row-major 4x3 for row vectors: p' = [x y z 1] * M. Stored as [m00..m32]. */
const IDENTITY = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];

export function parseTransform(s) {
  if (!s) return IDENTITY.slice();
  const v = s.trim().split(/\s+/).map(Number);
  if (v.length !== 12 || v.some((n) => !Number.isFinite(n))) throw new Error(`bad transform "${s}"`);
  return v;
}

/** a then b (apply a first, then b). */
export function compose(a, b) {
  const r = new Array(12);
  for (let i = 0; i < 4; i++) {
    const ax = i < 3 ? a[i * 3] : a[9];
    const ay = i < 3 ? a[i * 3 + 1] : a[10];
    const az = i < 3 ? a[i * 3 + 2] : a[11];
    const w = i < 3 ? 0 : 1;
    for (let j = 0; j < 3; j++) r[i * 3 + j] = ax * b[j] + ay * b[3 + j] + az * b[6 + j] + w * b[9 + j];
  }
  return r;
}

export function applyPoint(m, x, y, z) {
  return [x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]];
}

const attr = (tag, name) => {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
};

/** Parses every <object> of a .model XML string into { id, type, mesh?, components[] }. */
function parseObjects(xml) {
  const out = new Map();
  const re = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
  let m;
  while ((m = re.exec(xml))) {
    const head = m[1];
    const body = m[2];
    const id = attr(head, 'id');
    const type = attr(head, 'type') ?? 'model';
    const obj = { id, type, mesh: null, components: [] };
    const vSec = /<vertices>([\s\S]*?)<\/vertices>/.exec(body);
    if (vSec) {
      const pos = [];
      const vre = /<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g;
      let v;
      while ((v = vre.exec(vSec[1]))) pos.push(+v[1], +v[2], +v[3]);
      const idx = [];
      const tSec = /<triangles>([\s\S]*?)<\/triangles>/.exec(body);
      const tre = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g;
      let t;
      while (tSec && (t = tre.exec(tSec[1]))) idx.push(+t[1], +t[2], +t[3]);
      obj.mesh = { positions: pos, indices: idx };
    }
    const cre = /<component\b([^>]*)\/>/g;
    let c;
    while ((c = cre.exec(body))) {
      obj.components.push({
        path: attr(c[1], 'p:path'),
        objectid: attr(c[1], 'objectid'),
        transform: parseTransform(attr(c[1], 'transform')),
      });
    }
    out.set(id, obj);
  }
  return out;
}

/**
 * Loads a 3MF and returns flattened world-space parts:
 * [{ name, objectId, type, positions: Float64Array (xyz world mm), indices: Uint32Array }]
 */
export function load3mf(file) {
  const zip = unzipSync(readFileSync(file));
  const files = new Map();
  const getModel = (path) => {
    const key = path.replace(/^\//, '');
    if (!files.has(key)) {
      const data = zip[key];
      if (!data) throw new Error(`3MF part not found: ${path}`);
      files.set(key, parseObjects(strFromU8(data)));
    }
    return files.get(key);
  };
  const rootPath = '/3D/3dmodel.model';
  const rootXml = strFromU8(zip['3D/3dmodel.model']);
  const parts = [];

  const visit = (path, id, xf, depth) => {
    if (depth > 8) throw new Error('component nesting too deep');
    const obj = getModel(path).get(id);
    if (!obj) throw new Error(`object ${id} not found in ${path}`);
    if (obj.type === 'other') return; // modifiers / negative volumes: not printed geometry
    if (obj.mesh) {
      const { positions, indices } = obj.mesh;
      const w = new Float64Array(positions.length);
      for (let i = 0; i < positions.length; i += 3) {
        const p = applyPoint(xf, positions[i], positions[i + 1], positions[i + 2]);
        w[i] = p[0];
        w[i + 1] = p[1];
        w[i + 2] = p[2];
      }
      // Mirroring transforms (negative determinant) flip winding.
      const det =
        xf[0] * (xf[4] * xf[8] - xf[5] * xf[7]) - xf[1] * (xf[3] * xf[8] - xf[5] * xf[6]) + xf[2] * (xf[3] * xf[7] - xf[4] * xf[6]);
      const idx = Uint32Array.from(indices);
      if (det < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      parts.push({ path, objectId: id, positions: w, indices: idx });
    }
    for (const c of obj.components) visit(c.path ?? path, c.objectid, compose(c.transform, xf), depth + 1);
  };

  const ire = /<item\b([^>]*)\/>/g;
  let it;
  while ((it = ire.exec(rootXml))) visit(rootPath, attr(it[1], 'objectid'), parseTransform(attr(it[1], 'transform')), 0);
  return parts;
}
