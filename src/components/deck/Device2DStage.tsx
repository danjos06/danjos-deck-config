import { useElementSize } from '@/hooks/useElementSize';
import { useUiStore } from '@/store/uiStore';
import { DEVICE_H, DEVICE_W, Device } from './Device';

const MAX_SCALE = 1.9;
const PAD = 16;

/** Classic 2D stage: scales the drawn device (aspect preserved) to fit the available area. */
export function Device2DStage() {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const select = useUiStore((s) => s.select);
  const scale =
    size.width > 0 && size.height > 0
      ? Math.min(MAX_SCALE, (size.width - PAD * 2) / DEVICE_W, (size.height - PAD * 2) / DEVICE_H)
      : 0.5;
  const s = Math.max(0.2, scale);

  return (
    <div
      ref={ref}
      onClick={(e) => {
        if (e.target === e.currentTarget) select(null);
      }}
      className="relative flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden"
    >
      <div style={{ width: DEVICE_W * s, height: DEVICE_H * s }} className="relative shrink-0">
        <div style={{ transform: `scale(${s})`, transformOrigin: 'top left', width: DEVICE_W, height: DEVICE_H }} className="absolute left-0 top-0">
          <Device />
        </div>
      </div>
    </div>
  );
}
