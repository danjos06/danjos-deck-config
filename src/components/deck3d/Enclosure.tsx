import { useGLTF } from '@react-three/drei';
import type { Mesh } from 'three';
import type { DeckResources } from './resources';

export const BASE_URL = `${import.meta.env.BASE_URL}models/base.glb`;

/** The real angled shell (converted from base-angulada.3mf) in matte textured PLA, plus the back-wall labels. */
export function Enclosure({ res }: { res: DeckResources }) {
  const { nodes } = useGLTF(BASE_URL, false, true);
  const parts: { mesh: Mesh; material: DeckResources['mat'][keyof DeckResources['mat']] }[] = [
    { mesh: nodes.Enclosure as Mesh, material: res.mat.shell },
    { mesh: nodes.Labels as Mesh, material: res.mat.labels },
  ];
  return (
    <group>
      {parts.map(({ mesh, material }) => (
        <mesh
          key={mesh.name}
          geometry={mesh.geometry}
          position={mesh.position}
          quaternion={mesh.quaternion}
          scale={mesh.scale}
          material={material}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

useGLTF.preload(BASE_URL, false, true);
