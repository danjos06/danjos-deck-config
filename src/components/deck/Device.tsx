import { EncoderUnit } from './EncoderUnit';
import { KeyGrid } from './KeyGrid';
import { NavBar } from './NavBar';

export const DEVICE_W = 1060;
export const DEVICE_H = 560;

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute h-3 w-3 rounded-full bg-[radial-gradient(circle_at_35%_30%,theme(colors.ink.500),theme(colors.ink.900))] shadow-[0_1px_1px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)] ${className}`}
    >
      <span className="absolute left-1/2 top-1/2 h-px w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-black/70" />
    </span>
  );
}

/** The physical deck at its native size (DEVICE_W x DEVICE_H); DeckStage scales it to fit. */
export function Device() {
  return (
    <div
      style={{ width: DEVICE_W, height: DEVICE_H }}
      className="relative flex flex-col justify-between rounded-[40px] bg-gradient-to-b from-pla-hi via-pla-edge to-pla px-9 pb-7 pt-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_1px_0_rgba(255,255,255,0.14)_inset,0_-3px_0_rgba(0,0,0,0.6)_inset,0_50px_90px_-30px_rgba(0,0,0,0.95),0_0_120px_-40px_rgb(var(--accent)/0.25)]"
    >
      <div aria-hidden="true" className="bg-noise pointer-events-none absolute inset-0 rounded-[40px] opacity-[0.035]" />
      <Screw className="left-5 top-5" />
      <Screw className="right-5 top-5" />
      <Screw className="bottom-5 left-5" />
      <Screw className="bottom-5 right-5" />

      <div className="flex items-center justify-between px-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-fg-dim/80">Danjos Deck</span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-dim/60">
          ESP32-S3
          <span className="h-1.5 w-1.5 rounded-full bg-accent/80 shadow-led" />
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[150px_1fr_150px] items-center gap-6 pt-3">
        <EncoderUnit enc={0} />
        <KeyGrid />
        <EncoderUnit enc={1} />
      </div>

      <NavBar />
    </div>
  );
}
