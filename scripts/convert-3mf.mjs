#!/usr/bin/env node
/**
 * 3MF (Bambu Studio export) -> GLB pipeline for the 3D configurator stage.
 *
 *   npm run gen:models
 *
 * Inputs : assets-src/base-angulada.3mf, assets-src/knob.3mf   (kept as source of truth)
 * Outputs: public/models/base.glb, public/models/knob.glb
 *          src/components/deck3d/enclosure.generated.ts        (measured face/opening/knob metrics)
 *
 * Frames
 *   3MF is Z-up millimetres. Each mesh is placed by: component transform (p:path) then the build-item
 *   transform (3x4 row-major affine, row vectors). The output frame is Y-up, 1 unit = 100 mm,
 *   +Z = towards the user (front of the deck), X = width (left knob at -X), Y = 0 on the desk.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { meshopt, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { load3mf } from './lib/threemf.mjs';
import { bounds, concat, creaseNormals, mapVertices, weld } from './lib/mesh.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCALE = 0.01; // mm -> scene units (1 unit = 100 mm)
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// ---------------------------------------------------------------- measurements (source frame, mm)

/** Monotone chain convex hull of 2D points. */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 1e-9) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (const q of p.reverse()) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 1e-9) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

function measureShell(shell) {
  const P = shell.positions;
  const b = bounds(P);
  // Outer side-wall face (max Y in 3MF): its outline is the wedge profile; interior points = knob hole.
  const side = [];
  for (let i = 0; i < P.length; i += 3) if (P[i + 1] > b.max[1] - 0.01) side.push([P[i], P[i + 2]]);
  const h = hull(side);
  const onHull = new Set(h.map((q) => q.join()));
  const hole = side.filter((q) => !onHull.has(q.join()));
  const hc = hole.reduce((a, q) => [a[0] + q[0] / hole.length, a[1] + q[1] / hole.length], [0, 0]);
  const holeR = hole.reduce((a, q) => a + Math.hypot(q[0] - hc[0], q[1] - hc[1]) / hole.length, 0);

  // The open face = longest slanted hull edge of the profile.
  const centroid = h.reduce((a, q) => [a[0] + q[0] / h.length, a[1] + q[1] / h.length], [0, 0]);
  let best = null;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const c = h[(i + 1) % h.length];
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const ang = Math.abs((Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI) % 180;
    const slanted = ang > 20 && ang < 160 && Math.abs(ang - 90) > 10;
    if (slanted && (!best || len > best.len)) best = { a, c, len };
  }
  let t = [best.c[0] - best.a[0], best.c[1] - best.a[1]].map((v) => v / best.len);
  if (t[1] < 0) t = t.map((v) => -v); // tangent points up the slope
  let n = [-t[1], t[0]];
  const mid = [(best.a[0] + best.c[0]) / 2, (best.a[1] + best.c[1]) / 2];
  if ((mid[0] - centroid[0]) * n[0] + (mid[1] - centroid[1]) * n[1] < 0) n = n.map((v) => -v);

  // Signed distance of every vertex to the face direction -> rim plane, ledge rows.
  const rows = new Map();
  let dMax = -Infinity;
  for (let i = 0; i < P.length; i += 3) dMax = Math.max(dMax, P[i] * n[0] + P[i + 2] * n[1]);
  for (let i = 0; i < P.length; i += 3) {
    const d = P[i] * n[0] + P[i + 2] * n[1] - dMax;
    const u = P[i] * t[0] + P[i + 2] * t[1];
    const k = Math.round(d * 10) / 10;
    const r = rows.get(k) ?? { count: 0, umin: Infinity, umax: -Infinity, ymin: Infinity, ymax: -Infinity };
    r.count++;
    r.umin = Math.min(r.umin, u);
    r.umax = Math.max(r.umax, u);
    r.ymin = Math.min(r.ymin, P[i + 1]);
    r.ymax = Math.max(r.ymax, P[i + 1]);
    rows.set(k, r);
  }
  const rim = rows.get(0);
  // Ledges: the shallowest rows (below the rim) that span the inner width. They hold the face plate.
  const ledgeRows = [...rows]
    .filter(([d, r]) => d < -1 && r.ymin > b.min[1] + 1 && r.ymax < b.max[1] - 1 && r.ymax - r.ymin > b.size[1] * 0.85)
    .sort((x, y) => y[0] - x[0]);
  const ledgeD = ledgeRows[0][0];
  const sameLedge = ledgeRows.filter(([d]) => Math.abs(d - ledgeD) < 0.35).map(([, r]) => r);
  const inner = {
    umin: Math.min(...sameLedge.map((r) => r.umin)),
    umax: Math.max(...sameLedge.map((r) => r.umax)),
    ymin: Math.min(...sameLedge.map((r) => r.ymin)),
    ymax: Math.max(...sameLedge.map((r) => r.ymax)),
  };
  const angleDeg = (Math.atan2(t[1], t[0]) * 180) / Math.PI;
  return { b, n, t, dMax, rim, ledgeD, inner, hole: { c: hc, r: holeR }, angleDeg };
}

// ---------------------------------------------------------------- frames

/** 3MF base frame -> scene frame: X = -(y - cy), Y = z - zmin, Z = -(x - cx). Proper rotation (det +1). */
function baseFrame(b) {
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  const z0 = b.min[2];
  const pt = (x, y, z) => [-(y - cy) * SCALE, (z - z0) * SCALE, -(x - cx) * SCALE];
  const dir = (x, y, z) => [-y, z, -x];
  return { pt, dir };
}

// ---------------------------------------------------------------- glTF output

const io = new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
});

async function writeGlb(file, parts) {
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  doc.createBuffer();
  const scene = doc.createScene('Scene');
  for (const { name, mesh, crease, color, roughness } of parts) {
    const g = creaseNormals(mesh, crease);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(g.positions))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(g.normals))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(g.indices))
      .setMaterial(doc.createMaterial(name).setBaseColorFactor([...color, 1]).setRoughnessFactor(roughness).setMetallicFactor(0));
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  }
  await MeshoptEncoder.ready;
  await doc.transform(reorder({ encoder: MeshoptEncoder }), quantize(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  mkdirSync(dirname(file), { recursive: true });
  const bytes = await io.writeBinary(doc);
  writeFileSync(file, bytes);
  return bytes.byteLength;
}

// ---------------------------------------------------------------- main

async function convertBase() {
  const parts = load3mf(resolve(ROOT, 'assets-src/base-angulada.3mf'));
  const shellPart = parts.find((p) => p.objectId === '1');
  // Objects 2-4 are Bambu "text_shape" parts (OTG / SERIAL / RESET, 2nd filament) inlaid flush on the back wall:
  // kept as a separate lighter mesh. Object 5 (type="other", infill modifier) is skipped by the reader.
  const labelParts = parts.filter((p) => p.objectId !== '1');
  const shell = weld(shellPart.positions, shellPart.indices);
  const m = measureShell(shell);
  const f = baseFrame(m.b);

  const shellOut = mapVertices(shell, f.pt);
  // Labels sit flush with the back wall (+X in 3MF); push them out 0.15 mm to avoid z-fighting.
  const labels = mapVertices(weld(concat(labelParts).positions, concat(labelParts).indices), (x, y, z) => f.pt(x + 0.15, y, z));

  const size = await writeGlb(resolve(ROOT, 'public/models/base.glb'), [
    { name: 'Enclosure', mesh: shellOut, crease: 35, color: [0.035, 0.035, 0.038], roughness: 0.9 },
    { name: 'Labels', mesh: labels, crease: 35, color: [0.42, 0.43, 0.45], roughness: 0.7 },
  ]);

  // Face frame in scene units. Rim plane passes through dMax along n (source xz).
  const n3 = f.dir(m.n[0], 0, m.n[1]);
  const t3 = f.dir(m.t[0], 0, m.t[1]);
  const onPlane = (u, d, y) => {
    // source point with u along t, d along n (d relative to rim), y = width
    const x = m.t[0] * u + m.n[0] * (m.dMax + d);
    const z = m.t[1] * u + m.n[1] * (m.dMax + d);
    return f.pt(x, y, z).map(r4);
  };
  const cyIn = (m.inner.ymin + m.inner.ymax) / 2;
  const uMidIn = (m.inner.umin + m.inner.umax) / 2;
  const holeScene = f.pt(m.hole.c[0], m.b.max[1], m.hole.c[1]);
  const metrics = {
    /** Scene-frame bounding size [width X, height Y, depth Z]. */
    size: [m.b.size[1], m.b.size[2], m.b.size[0]].map((v) => r4(v * SCALE)),
    sizeMm: { width: r4(m.b.size[1]), depth: r4(m.b.size[0]), height: r4(m.b.size[2]) },
    faceAngleDeg: r4(m.angleDeg),
    faceNormal: n3.map(r4),
    faceUp: t3.map(r4),
    rimSizeMm: { width: r4(m.rim.ymax - m.rim.ymin), slope: r4(m.rim.umax - m.rim.umin) },
    openingMm: { width: r4(m.inner.ymax - m.inner.ymin), slope: r4(m.inner.umax - m.inner.umin) },
    ledgeDepthMm: r4(-m.ledgeD),
    /** Centre of the inner opening, on the rim plane. */
    openingCenter: onPlane(uMidIn, 0, cyIn),
    knobAxis: { y: r4(holeScene[1]), z: r4(holeScene[2]), wallX: r4(holeScene[0] < 0 ? -holeScene[0] : holeScene[0]) },
    knobHoleRadiusMm: r4(m.hole.r),
  };
  return { size, metrics };
}

async function convertKnob() {
  const parts = load3mf(resolve(ROOT, 'assets-src/knob.3mf'));
  const merged = weld(concat(parts).positions, concat(parts).indices);
  const b = bounds(merged.positions);
  const cx = (b.min[0] + b.max[0]) / 2;
  const cy = (b.min[1] + b.max[1]) / 2;
  // Axis -> +Y. The printed bed face (z = min) is the smooth outer cap; y = 0 is the face mounted against the wall.
  // X = x - cx, Y = zmax - z, Z = y - cy  (det +1).
  const knob = mapVertices(merged, (x, y, z) => [(x - cx) * SCALE, (b.max[2] - z) * SCALE, (y - cy) * SCALE]);
  const size = await writeGlb(resolve(ROOT, 'public/models/knob.glb'), [
    { name: 'Knob', mesh: knob, crease: 40, color: [0.03, 0.03, 0.033], roughness: 0.85 },
  ]);
  return {
    size,
    metrics: { diameterMm: r4(Math.max(b.size[0], b.size[1])), thicknessMm: r4(b.size[2]) },
  };
}

const base = await convertBase();
const knob = await convertKnob();
const ts = `// AUTO-GENERATED by scripts/convert-3mf.mjs (npm run gen:models). Do not edit.
// Scene units: 1 unit = 100 mm. Y-up, +Z = front of the deck, Y = 0 on the desk.

export const ENCLOSURE = ${JSON.stringify(base.metrics, null, 2)} as const;

export const KNOB = ${JSON.stringify(knob.metrics, null, 2)} as const;
`;
writeFileSync(resolve(ROOT, 'src/components/deck3d/enclosure.generated.ts'), ts);
console.log(`base.glb ${(base.size / 1024).toFixed(1)} KiB, knob.glb ${(knob.size / 1024).toFixed(1)} KiB`);
console.log(JSON.stringify({ base: base.metrics, knob: knob.metrics }, null, 2));
