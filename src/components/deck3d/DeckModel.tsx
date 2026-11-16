import { useCallback, useEffect } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { EncoderFn } from '@/core/types';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { canNavigate, navTarget } from '../deck/pageNav';
import { handleKeyClick, isKeySelected } from '../deck/keySelection';
import { CameraRig } from './CameraRig';
import { Enclosure } from './Enclosure';
import { Keycap3D } from './Keycap3D';
import { Knob3D } from './Knob3D';
import { FACE, KEY_POSITIONS, NAV, NAV_ROW_Y, PLATE } from './layout';
import { Logo3D } from './Logo3D';
import { NavKey3D } from './NavKey3D';
import { useDeckResources } from './resources';

/** The whole physical deck: real shell + procedural face plate, keys, nav keys, logo and side knobs. */
export function DeckModel({ onReady }: { onReady?: () => void }) {
  const res = useDeckResources();
  const reduced = useReducedMotion() ?? false;
  const pages = useDeckStore((s) => s.config.pages);
  const pins = useDeckStore((s) => s.config.hardware.pins);
  const currentId = useUiStore((s) => s.currentPageId);
  const direction = useUiStore((s) => s.navDirection);
  const selection = useUiStore((s) => s.selection);
  const select = useUiStore((s) => s.select);
  const setPage = useUiStore((s) => s.setCurrentPage);
  const openModal = useUiStore((s) => s.openModal);

  useEffect(() => onReady?.(), [onReady]);

  const page = pages.find((p) => p.id === currentId) ?? pages[0];
  const canNav = canNavigate(pages, currentId);

  const onNav = useCallback(
    (step: 1 | -1) => {
      const target = navTarget(useDeckStore.getState().config.pages, useUiStore.getState().currentPageId, step);
      if (target) setPage(target.id, step);
    },
    [setPage],
  );
  const onTurn = useCallback(
    (enc: 0 | 1, fn: EncoderFn) => {
      const cur = useUiStore.getState().selection;
      if (cur?.kind === 'encoder' && cur.enc === enc && cur.fn === fn) return;
      select({ kind: 'encoder', enc, fn });
    },
    [select],
  );
  const onPush = useCallback((enc: 0 | 1) => onTurn(enc, 'sw'), [onTurn]);
  const onDisabledClick = useCallback(() => openModal('pinout'), [openModal]);

  const encDisabled = [pins.enc1Clk === -1 || pins.enc1Dt === -1, pins.enc2Clk === -1 || pins.enc2Dt === -1];
  const swEnabled = [pins.enc1Sw !== -1, pins.enc2Sw !== -1];

  return (
    <group>
      <CameraRig res={res} reducedMotion={reduced} />
      <Enclosure res={res} />
      <group position={FACE.origin} rotation-x={FACE.tiltX}>
        <mesh geometry={res.geo.plate} material={res.mat.plate} position-z={PLATE.top} receiveShadow onClick={(e) => e.stopPropagation()} />
        {page?.keys.map((k, i) => (
          <Keycap3D
            key={i}
            res={res}
            index={i}
            x={KEY_POSITIONS[i][0]}
            y={KEY_POSITIONS[i][1]}
            bitmap={k.bitmap}
            pageKey={page.id}
            direction={direction}
            selected={isKeySelected(selection, i)}
            reducedMotion={reduced}
            onSelect={handleKeyClick}
          />
        ))}
        <NavKey3D res={res} dir={-1} x={-NAV.x} y={NAV_ROW_Y} disabled={!canNav} reducedMotion={reduced} onPress={onNav} />
        <NavKey3D res={res} dir={1} x={NAV.x} y={NAV_ROW_Y} disabled={!canNav} reducedMotion={reduced} onPress={onNav} />
        <Logo3D res={res} y={NAV_ROW_Y} />
      </group>
      {([0, 1] as const).map((enc) => (
        <Knob3D
          key={enc}
          res={res}
          enc={enc}
          disabled={encDisabled[enc]}
          swEnabled={swEnabled[enc]}
          reducedMotion={reduced}
          onTurn={onTurn}
          onPush={onPush}
          onDisabledClick={onDisabledClick}
        />
      ))}
    </group>
  );
}
