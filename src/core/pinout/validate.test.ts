import { describe, expect, it } from 'vitest';
import { createDefaultHardware } from '../defaults';
import type { HardwareConfig, PinId } from '../types';
import { describeGpio } from './esp32s3';
import { validateHardware, type PinIssue } from './validate';

const hw = (patch: (h: HardwareConfig) => void = () => undefined): HardwareConfig => {
  const h = createDefaultHardware();
  patch(h);
  return h;
};
const find = (issues: PinIssue[], pin: PinIssue['pin'], severity?: PinIssue['severity']) =>
  issues.filter((i) => i.pin === pin && (!severity || i.severity === severity));

describe('validateHardware', () => {
  it('default hardware has no errors', () => {
    expect(validateHardware(hw()).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('flags nonexistent GPIOs (22-25, 49+)', () => {
    for (const g of [22, 25, 49, 100]) {
      expect(find(validateHardware(hw((h) => (h.pins.btn0 = g))), 'btn0', 'error')).toHaveLength(1);
    }
  });

  it('flags duplicates across enabled pins but ignores disabled ones', () => {
    const issues = validateHardware(hw((h) => (h.pins.btn1 = h.pins.btn0)));
    expect(find(issues, 'btn0', 'error')).toHaveLength(1);
    expect(find(issues, 'btn1', 'error')).toHaveLength(1);
    const ok = validateHardware(hw()); // enc2 pins are all -1 (duplicates of -1 are fine)
    expect(ok.some((i) => i.message.includes('já está em uso'))).toBe(false);
  });

  it('flags USB, flash pins as errors', () => {
    expect(find(validateHardware(hw((h) => (h.pins.enc2Clk = 20))), 'enc2Clk', 'error')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.pins.enc2Clk = 19))), 'enc2Clk', 'error')).toHaveLength(1);
    for (const g of [26, 29, 32]) {
      expect(find(validateHardware(hw((h) => (h.pins.btn0 = g))), 'btn0', 'error')).toHaveLength(1);
    }
  });

  it('warns for strapping, psram, uart and jtag pins', () => {
    for (const g of [0, 3, 45, 46, 33, 37, 43, 44, 39, 42]) {
      const issues = validateHardware(hw((h) => {
        h.pins.btn2 = 10; // avoid colliding with the default GPIO 3
        h.pins.enc2Clk = g;
      }));
      expect(find(issues, 'enc2Clk', 'warning')).toHaveLength(1);
      expect(find(issues, 'enc2Clk', 'error')).toHaveLength(0);
    }
    expect(find(validateHardware(hw((h) => (h.pins.enc2Clk = 38))), 'enc2Clk', 'warning')).toHaveLength(0);
  });

  it('requires SDA/SCL enabled and distinct', () => {
    expect(find(validateHardware(hw((h) => (h.pins.sda = -1))), 'sda', 'error')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.pins.scl = -1))), 'scl', 'error')).toHaveLength(1);
    const same = validateHardware(hw((h) => (h.pins.scl = h.pins.sda)));
    expect(find(same, 'sda', 'error')[0].message).toContain('SDA e SCL');
    expect(find(same, 'scl', 'error')).toHaveLength(1);
  });

  it('validates mux and OLED addresses', () => {
    expect(find(validateHardware(hw((h) => (h.muxAddress = 0x6f))), 'muxAddress', 'error')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.muxAddress = 0x78))), 'muxAddress', 'error')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.muxAddress = 0x77))), 'muxAddress')).toHaveLength(0);
    expect(find(validateHardware(hw((h) => (h.oledAddress = 0x3d))), 'oledAddress')).toHaveLength(0);
    expect(find(validateHardware(hw((h) => (h.oledAddress = 0x3e))), 'oledAddress', 'error')).toHaveLength(1);
  });

  it('validates mux channels range and duplicates', () => {
    expect(find(validateHardware(hw((h) => (h.muxChannels[2] = 8))), 'muxChannel2', 'error')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.muxChannels[2] = -1))), 'muxChannel2', 'error')).toHaveLength(1);
    const dup = validateHardware(hw((h) => (h.muxChannels[4] = 1)));
    expect(find(dup, 'muxChannel1', 'error')).toHaveLength(1);
    expect(find(dup, 'muxChannel4', 'error')).toHaveLength(1);
  });

  it('gives info for partially configured encoders and disabled switch', () => {
    expect(find(validateHardware(hw((h) => (h.pins.enc1Dt = -1))), 'enc1Dt', 'info')).toHaveLength(1);
    expect(find(validateHardware(hw((h) => (h.pins.enc1Sw = -1))), 'enc1Sw', 'info')).toHaveLength(1);
    const ids: PinId[] = ['enc2Clk', 'enc2Dt', 'enc2Sw'];
    const issues = validateHardware(hw());
    expect(issues.filter((i) => ids.includes(i.pin as PinId))).toHaveLength(0);
  });
});

describe('describeGpio', () => {
  it('describes existence and tags', () => {
    expect(describeGpio(23).exists).toBe(false);
    expect(describeGpio(5).exists).toBe(true);
    expect(describeGpio(19).tags).toContain('usb');
    expect(describeGpio(0).tags).toContain('strapping');
    expect(describeGpio(30).tags).toContain('flash');
    expect(describeGpio(35).tags).toContain('psram');
  });
});
