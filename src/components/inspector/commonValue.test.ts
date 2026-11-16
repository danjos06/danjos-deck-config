import { describe, expect, it } from 'vitest';
import { commonValue, isMixed, jsonEquals, MIXED } from './commonValue';

describe('commonValue', () => {
  it('returns the shared value', () => {
    expect(commonValue([3, 3, 3])).toBe(3);
    expect(commonValue(['a'])).toBe('a');
    expect(commonValue([false, false])).toBe(false);
  });
  it('returns MIXED when values differ or there are none', () => {
    expect(commonValue([1, 2, 1])).toBe(MIXED);
    expect(isMixed(commonValue([]))).toBe(true);
    expect(isMixed(commonValue([true, false]))).toBe(true);
    expect(isMixed(commonValue([1, 1]))).toBe(false);
  });
  it('supports undefined values and a custom comparator', () => {
    expect(commonValue([undefined, undefined])).toBeUndefined();
    expect(isMixed(commonValue([undefined, 1]))).toBe(true);
    const a = { type: 'text', text: 'x' };
    expect(commonValue([a, { ...a }], jsonEquals)).toBe(a);
    expect(isMixed(commonValue([a, { type: 'none' }], jsonEquals))).toBe(true);
  });
});
