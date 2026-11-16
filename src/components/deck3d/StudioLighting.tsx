import { ContactShadows, Environment, Lightformer } from '@react-three/drei';
import type { Palette } from './palette';

/**
 * Network-free studio: an environment rendered once from local Lightformers (no HDR preset download),
 * a key + rim light, and a soft contact shadow on the (transparent) floor.
 */
export function StudioLighting({ palette }: { palette: Palette }) {
  return (
    <>
      <ambientLight intensity={0.12} />
      <directionalLight position={[2.2, 3.6, 3]} intensity={1.5} />
      <directionalLight position={[-3, 1.6, -1.5]} intensity={0.55} color={palette.hover} />
      <Environment resolution={256} frames={1}>
        {/* big overhead softbox */}
        <Lightformer form="rect" intensity={2.4} position={[0, 5, 1.5]} rotation-x={Math.PI / 2} scale={[7, 4, 1]} />
        {/* front fill */}
        <Lightformer form="rect" intensity={0.7} position={[0.5, 1.2, 5]} scale={[6, 1.6, 1]} />
        {/* side strips -> crisp edge highlights on the shell and knob knurls */}
        <Lightformer form="rect" intensity={1.8} position={[5, 1.4, 0.5]} rotation-y={-Math.PI / 2} scale={[4, 0.9, 1]} />
        <Lightformer form="rect" intensity={1.1} position={[-5, 1.6, 0.8]} rotation-y={Math.PI / 2} scale={[4, 0.9, 1]} />
        {/* faint brand-cyan bounce from behind */}
        <Lightformer form="ring" intensity={0.9} color={palette.accent} position={[0, 1.2, -5]} scale={3} />
      </Environment>
      <ContactShadows position={[0, 0.0005, 0]} opacity={0.82} scale={4} blur={2.2} far={1.2} resolution={512} frames={1} color={palette.shadow} />
    </>
  );
}
