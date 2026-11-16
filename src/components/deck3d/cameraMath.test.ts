import { describe, expect, it } from 'vitest';
import { fitBox, fitDistance, smoothDamp, type Damper } from './cameraMath';

describe('smoothDamp', () => {
  it('converges without overshoot from rest', () => {
    const d: Damper = { value: 0, velocity: 0 };
    let max = 0;
    for (let i = 0; i < 200; i++) {
      smoothDamp(d, 1, 8.5, 1 / 60);
      max = Math.max(max, d.value);
    }
    expect(max).toBeLessThanOrEqual(1);
    expect(d.value).toBe(1);
  });
  it('reaches 98% in 600-800 ms', () => {
    const d: Damper = { value: 0, velocity: 0 };
    let t = 0;
    while (d.value < 0.98) {
      smoothDamp(d, 1, 8.4, 1 / 60);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(0.8);
    expect(t).toBeGreaterThan(0.55);
  });
});

describe('fit', () => {
  const v = { fov: 30, aspect: 1.5, usableH: 1 };
  it('grows with the box', () => {
    expect(fitDistance(v, 2, 1)).toBeGreaterThan(fitDistance(v, 1, 1));
  });
  it('a narrower usable height needs more distance', () => {
    expect(fitDistance({ ...v, usableH: 0.8 }, 1, 1)).toBeGreaterThanOrEqual(fitDistance(v, 1, 1));
  });
  it('fitBox adds depth', () => {
    const box = { w: 1, h: 0.5, d: 0.4 };
    expect(fitBox(v, box, 0, 0, 1)).toBeCloseTo(fitDistance(v, 1, 0.5) + 0.4);
  });
});
