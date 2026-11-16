import { useCallback, useMemo, useState } from 'react';
import { createDefaultHardware } from '@/core/defaults';
import { validateHardware } from '@/core/pinout/validate';
import { hex } from '@/lib/ui/format';
import { useDeckStore } from '@/store/deckStore';
import { useUiStore } from '@/store/uiStore';
import { Badge, Button, Field, Icon, Modal, Select, toast } from '../../ui';
import { PinDiagram } from './PinDiagram';
import { pinRowId, PinTable, SEVERITY_ICON, SEVERITY_TONE } from './PinTable';
import type { PinId } from '@/core/types';

const MUX_ADDR = [0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77];

export function PinoutModal() {
  const open = useUiStore((s) => s.modal === 'pinout');
  const close = useUiStore((s) => s.closeModal);
  const hardware = useDeckStore((s) => s.config.hardware);
  const setHardware = useDeckStore((s) => s.setHardware);
  const issues = useMemo(() => validateHardware(hardware), [hardware]);
  const counts = useMemo(
    () => ({ error: issues.filter((i) => i.severity === 'error').length, warning: issues.filter((i) => i.severity === 'warning').length }),
    [issues],
  );

  const [hoverGpio, setHoverGpio] = useState<number | null>(null);
  /** Board pad clicked: scroll to and focus the GPIO input of the pin(s) using it. */
  const activatePad = useCallback(
    (gpio: number) => {
      const id = (Object.keys(hardware.pins) as PinId[]).find((k) => hardware.pins[k] === gpio);
      if (!id) {
        toast.info(`GPIO ${gpio} está livre.`);
        return;
      }
      const row = document.getElementById(pinRowId(id));
      row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row?.querySelector('input')?.focus({ preventScroll: true });
    },
    [hardware.pins],
  );

  const setChannel = (i: number, ch: number) => setHardware({ muxChannels: hardware.muxChannels.map((c, k) => (k === i ? ch : c)) });
  const chIssue = (i: number) => issues.find((x) => x.pin === `muxChannel${i}`);

  return (
    <Modal
      open={open}
      onClose={close}
      title="Pinout e hardware"
      subtitle="ESP32-S3 · pinos, multiplexador I2C e telas OLED"
      className="[--w:1080px]"
      headerExtra={
        <div className="hidden items-center gap-1.5 sm:flex">
          {counts.error > 0 && <Badge tone="danger">{counts.error} erro(s)</Badge>}
          {counts.warning > 0 && <Badge tone="warn">{counts.warning} aviso(s)</Badge>}
          {issues.length === 0 && <Badge tone="ok">Tudo certo</Badge>}
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-fg-dim">As mudanças valem ao exportar o .ino ou sincronizar (firmware v2).</p>
          <Button
            icon="restart_alt"
            onClick={() => {
              setHardware(createDefaultHardware());
              toast.info('Hardware restaurado para o padrão.');
            }}
          >
            Restaurar padrão
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
          <PinDiagram pins={hardware.pins} issues={issues} highlight={hoverGpio} onHover={setHoverGpio} onActivate={activatePad} />
        </div>
        <div className="min-w-0 space-y-4">
          <PinTable hardware={hardware} issues={issues} highlight={hoverGpio} onRowHover={setHoverGpio} />

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] p-3">
            <Field label="Multiplexador TCA9548A" error={issues.find((i) => i.pin === 'muxAddress')?.message}>
              {(id) => (
                <Select id={id} mono value={hardware.muxAddress} onChange={(e) => setHardware({ muxAddress: Number(e.target.value) })}>
                  {MUX_ADDR.map((a) => (
                    <option key={a} value={a}>
                      {hex(a)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Endereço do OLED" error={issues.find((i) => i.pin === 'oledAddress')?.message}>
              {(id) => (
                <Select id={id} mono value={hardware.oledAddress} onChange={(e) => setHardware({ oledAddress: Number(e.target.value) })}>
                  <option value={0x3c}>0x3C</option>
                  <option value={0x3d}>0x3D</option>
                </Select>
              )}
            </Field>
            <div className="col-span-2">
              <p className="mb-1.5 text-xs font-medium text-fg-muted">Canal do multiplexador por tela</p>
              <div className="grid grid-cols-3 gap-2">
                {hardware.muxChannels.slice(0, 6).map((ch, i) => (
                  <label key={i} className="min-w-0">
                    <span className="mb-0.5 block text-[11px] text-fg-dim">Tela {i + 1}</span>
                    <Select
                      mono
                      value={ch}
                      aria-label={`Canal da tela ${i + 1}`}
                      onChange={(e) => setChannel(i, Number(e.target.value))}
                      className={chIssue(i) ? 'border-danger/60' : ''}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => (
                        <option key={c} value={c}>
                          CH{c}
                        </option>
                      ))}
                    </Select>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div aria-live="polite">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-dim">Validação</h3>
            {issues.length === 0 ? (
              <p className="flex items-center gap-2 rounded-lg bg-ok/10 p-3 text-xs text-ok">
                <Icon name="check_circle" fill size={16} /> Nenhum problema encontrado na configuração de hardware.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {issues.map((i, k) => (
                  <li key={`${i.pin}-${k}`} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-ink-950 p-2.5 text-xs leading-snug text-fg-muted">
                    <Badge tone={SEVERITY_TONE[i.severity]} className="mt-px">
                      <Icon name={SEVERITY_ICON[i.severity]} size={11} fill />
                    </Badge>
                    <span>{i.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
