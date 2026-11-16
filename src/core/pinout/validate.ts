import { PIN_IDS } from '../constants';
import type { HardwareConfig, PinId } from '../types';
import { gpioExists, PIN_LABELS } from './esp32s3';

export { describeGpio } from './esp32s3';

export type PinSeverity = 'error' | 'warning' | 'info';

export interface PinIssue {
  pin: PinId | 'muxAddress' | 'oledAddress' | `muxChannel${number}`;
  severity: PinSeverity;
  message: string;
  gpio?: number;
}

const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

/** Validates a hardware configuration against ESP32-S3 constraints. Messages are in pt-BR. */
export function validateHardware(h: HardwareConfig): PinIssue[] {
  const issues: PinIssue[] = [];
  const add = (pin: PinIssue['pin'], severity: PinSeverity, message: string, gpio?: number) =>
    issues.push({ pin, severity, message, ...(gpio !== undefined ? { gpio } : {}) });

  const used = new Map<number, PinId[]>();
  for (const id of PIN_IDS) {
    const g = h.pins[id];
    const label = PIN_LABELS[id];
    if (g === -1) {
      if (id === 'sda') add(id, 'error', 'SDA está desativado: o I2C (telas OLED) não funcionará.');
      if (id === 'scl') add(id, 'error', 'SCL está desativado: o I2C (telas OLED) não funcionará.');
      continue;
    }
    if (!gpioExists(g)) {
      add(id, 'error', `${label}: GPIO ${Number.isFinite(g) ? g : '?'} não existe no ESP32-S3 (válidos: 0-21 e 26-48).`, g);
      continue;
    }
    used.set(g, [...(used.get(g) ?? []), id]);
    if (g === 19 || g === 20) {
      add(id, 'error', `${label}: GPIO ${g} é o USB nativo (D-/D+) usado pelo HID do firmware.`, g);
    } else if (g >= 26 && g <= 32) {
      add(id, 'error', `${label}: GPIO ${g} é reservado para a flash SPI.`, g);
    } else if (g === 0 || g === 3 || g === 45 || g === 46) {
      add(id, 'warning', `${label}: GPIO ${g} é um pino de strapping (afeta o boot se estiver em nível errado ao ligar).`, g);
    } else if (g >= 33 && g <= 37) {
      add(id, 'warning', `${label}: GPIO ${g} é usado pela PSRAM octal em módulos R8/N8R8.`, g);
    } else if (g === 43 || g === 44) {
      add(id, 'warning', `${label}: GPIO ${g} é UART0 (${g === 43 ? 'TX' : 'RX'}) e conflita com o log serial.`, g);
    } else if (g >= 39 && g <= 42) {
      add(id, 'warning', `${label}: GPIO ${g} é um pino JTAG.`, g);
    }
  }

  for (const [g, ids] of used) {
    if (ids.length < 2) continue;
    const both = ids.includes('sda') && ids.includes('scl');
    for (const id of ids) {
      const others = ids.filter((o) => o !== id).map((o) => PIN_LABELS[o]).join(', ');
      add(
        id,
        'error',
        both && (id === 'sda' || id === 'scl')
          ? `SDA e SCL não podem usar o mesmo GPIO (${g}).`
          : `${PIN_LABELS[id]}: GPIO ${g} já está em uso por ${others}.`,
        g,
      );
    }
  }

  // Encoders: partially configured / switch disabled (informational)
  const encs: { n: number; clk: PinId; dt: PinId; sw: PinId }[] = [
    { n: 1, clk: 'enc1Clk', dt: 'enc1Dt', sw: 'enc1Sw' },
    { n: 2, clk: 'enc2Clk', dt: 'enc2Dt', sw: 'enc2Sw' },
  ];
  for (const e of encs) {
    const clkOn = h.pins[e.clk] !== -1;
    const dtOn = h.pins[e.dt] !== -1;
    if (clkOn !== dtOn) {
      add(clkOn ? e.dt : e.clk, 'info', `Encoder ${e.n} parcialmente configurado: CLK e DT precisam estar ativos para detectar a rotação.`);
    } else if (clkOn && dtOn && h.pins[e.sw] === -1) {
      add(e.sw, 'info', `Encoder ${e.n}: botão (SW) desativado; o clique não terá ação.`);
    }
  }

  if (!Number.isInteger(h.muxAddress) || h.muxAddress < 0x70 || h.muxAddress > 0x77) {
    add('muxAddress', 'error', `Endereço do TCA9548A ${Number.isFinite(h.muxAddress) ? hex(h.muxAddress) : '?'} inválido: use 0x70 a 0x77.`);
  }
  if (h.oledAddress !== 0x3c && h.oledAddress !== 0x3d) {
    add('oledAddress', 'error', `Endereço do OLED ${Number.isFinite(h.oledAddress) ? hex(h.oledAddress) : '?'} inválido: use 0x3C ou 0x3D.`);
  }

  const seen = new Map<number, number[]>();
  for (let i = 0; i < 6; i++) {
    const ch = h.muxChannels[i];
    const pin = `muxChannel${i}` as const;
    if (!Number.isInteger(ch) || ch < 0 || ch > 7) {
      add(pin, 'error', `Tela ${i + 1}: canal do multiplexador inválido (use 0 a 7).`);
      continue;
    }
    seen.set(ch, [...(seen.get(ch) ?? []), i]);
  }
  for (const [ch, screens] of seen) {
    if (screens.length < 2) continue;
    for (const i of screens) {
      add(`muxChannel${i}`, 'error', `Tela ${i + 1}: canal ${ch} repetido (também usado por ${screens.filter((s) => s !== i).map((s) => `tela ${s + 1}`).join(', ')}).`);
    }
  }
  return issues;
}
