import { MeshStandardMaterial, type Color } from 'three';

export interface PlaOptions {
  color: Color;
  roughness?: number;
  /** Grain bump height in scene units (1 unit = 100 mm). 0.0004 = 0.04 mm. */
  grain?: number;
  /** Grain feature frequency in cycles per scene unit (250 = ~0.4 mm features). */
  grainScale?: number;
  transparent?: boolean;
  opacity?: number;
}

const NOISE_GLSL = /* glsl */ `
varying vec3 vPlaPos;
uniform float uGrain;
uniform float uGrainScale;
float plaHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float plaNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(plaHash(i), plaHash(i + vec3(1, 0, 0)), f.x), mix(plaHash(i + vec3(0, 1, 0)), plaHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(plaHash(i + vec3(0, 0, 1)), plaHash(i + vec3(1, 0, 1)), f.x), mix(plaHash(i + vec3(0, 1, 1)), plaHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z) * 2.0 - 1.0;
}
float plaHeight(vec3 p) {
  vec3 q = p * uGrainScale;
  return plaNoise(q) * 0.62 + plaNoise(q * 2.31 + 7.1) * 0.38;
}
vec3 plaPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = dFdx(surfPos);
  vec3 sy = dFdy(surfPos);
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

/**
 * Matte black textured PLA: MeshStandardMaterial + object-space procedural grain applied as a
 * derivative bump (no UVs needed, stays glued to moving parts) and a little roughness variation.
 * The grain fades out when it would alias (feature smaller than ~1 px).
 */
export function createPlaMaterial(o: PlaOptions): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: o.color,
    roughness: o.roughness ?? 0.88,
    metalness: 0,
    transparent: o.transparent ?? false,
    opacity: o.opacity ?? 1,
    envMapIntensity: 0.9,
  });
  const grain = o.grain ?? 0.0004;
  const scale = o.grainScale ?? 250;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrain = { value: grain };
    shader.uniforms.uGrainScale = { value: scale };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPlaPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlaPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float plaH = plaHeight(vPlaPos);
        float plaFw = length(fwidth(vPlaPos * uGrainScale));
        float plaFade = 1.0 - smoothstep(0.55, 1.3, plaFw);
        roughnessFactor = clamp(roughnessFactor + plaH * 0.05 * plaFade, 0.0, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec2 plaD = vec2(dFdx(plaH), dFdy(plaH)) * uGrain * plaFade;
        normal = plaPerturb(-vViewPosition, normal, plaD, faceDirection);`,
      );
  };
  m.customProgramCacheKey = () => 'pla-grain-v1';
  return m;
}
