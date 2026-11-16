import { memo } from 'react';
import { BOARD } from './devkitc1';

const M = { x: 55, w: 150, top: 0, antenna: 62, bottom: 272 }; // WROOM-1 module

function UsbC({ x, label }: { x: number; label: string }) {
  const y = BOARD.bottom - 22;
  return (
    <g>
      <rect x={x} y={y} width={64} height={46} rx={10} className="fill-pcb-metal stroke-pcb-metalDeep" strokeWidth={2} />
      <rect x={x + 9} y={y + 30} width={46} height={10} rx={5} className="fill-pcb-chip" />
      <text x={x + 32} y={y - 8} textAnchor="middle" className="fill-pcb-silk" fontSize={11} fontWeight={700}>
        {label}
      </text>
    </g>
  );
}

function Button({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={34} height={30} rx={3} className="fill-pcb-metal stroke-pcb-metalDeep" strokeWidth={1.5} />
      <circle cx={x + 17} cy={y + 15} r={8} className="fill-pcb-chip" />
      <text x={x + 44} y={y + 19} className="fill-pcb-silk" fontSize={10} fontWeight={700}>
        {label}
      </text>
    </g>
  );
}

/** Static SVG drawing of the ESP32-S3-DevKitC-1 clone (black PCB). Pads are drawn by PinDiagram. */
export const BoardArt = memo(function BoardArt() {
  const { w, top, bottom } = BOARD;
  const antenna = [] as string[];
  for (let i = 0; i < 5; i++) antenna.push(`${i === 0 ? 'M' : 'L'}${M.x + 22 + i * 24} ${M.top + 14} L${M.x + 22 + i * 24} ${M.top + 44} L${M.x + 34 + i * 24} ${M.top + 44} L${M.x + 34 + i * 24} ${M.top + 14}`);
  return (
    <g aria-hidden="true">
      {/* PCB */}
      <rect x={0} y={top} width={w} height={bottom - top} rx={10} className="fill-pcb-board stroke-pcb-edge" strokeWidth={2} />
      {/* WROOM-1: antenna PCB + shield can */}
      <rect x={M.x} y={M.top} width={M.w} height={M.bottom - M.top} rx={4} className="fill-pcb-chip stroke-pcb-edge" strokeWidth={1.5} />
      <path d={antenna.join(' ')} fill="none" className="stroke-pcb-gold" strokeWidth={3} strokeLinejoin="round" opacity={0.75} />
      <rect x={M.x + 8} y={M.antenna} width={M.w - 16} height={M.bottom - M.antenna - 8} rx={4} className="fill-pcb-metal stroke-pcb-metalDeep" strokeWidth={1.5} />
      <text x={M.x + M.w / 2} y={M.antenna + 46} textAnchor="middle" className="fill-pcb-chip" fontSize={15} fontWeight={800}>
        ESPRESSIF
      </text>
      <text x={M.x + M.w / 2} y={M.antenna + 68} textAnchor="middle" className="fill-pcb-chip" fontSize={10.5} fontWeight={600}>
        ESP32-S3-WROOM-1
      </text>
      <rect x={M.x + 92} y={M.antenna + 120} width={34} height={34} className="fill-pcb-metalDeep" opacity={0.6} />
      {/* LDO (SOT-223) */}
      <rect x={78} y={312} width={40} height={30} rx={2} className="fill-pcb-chip stroke-pcb-edge" />
      <rect x={84} y={300} width={28} height={12} className="fill-pcb-metal" />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={82 + i * 13} y={342} width={6} height={9} className="fill-pcb-metal" />
      ))}
      <text x={98} y={368} textAnchor="middle" className="fill-pcb-silk" fontSize={9}>
        LDO
      </text>
      {/* buttons */}
      <Button x={150} y={300} label="RST" />
      <Button x={150} y={350} label="BOOT" />
      {/* RGB LED (WS2812) */}
      <rect x={80} y={392} width={34} height={34} rx={3} className="fill-pcb-silk" />
      <circle cx={97} cy={409} r={9} className="fill-pcb-metal" opacity={0.7} />
      <text x={122} y={414} className="fill-pcb-silk" fontSize={10} fontWeight={700}>
        RGB
      </text>
      {/* misc: USB-UART bridge, small passives */}
      <rect x={150} y={470} width={36} height={36} rx={3} className="fill-pcb-chip stroke-pcb-edge" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={84 + i * 16} y={470} width={8} height={14} rx={1} className="fill-pcb-goldDeep" />
      ))}
      <UsbC x={52} label="UART/COM" />
      <UsbC x={144} label="USB" />
    </g>
  );
});
