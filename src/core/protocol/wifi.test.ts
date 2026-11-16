import { describe, expect, it } from 'vitest';
import { isMixedContentBlocked, normalizeIp } from './wifi';

describe('normalizeIp', () => {
  it('accepts plain IPs, URLs and hostnames', () => {
    expect(normalizeIp('192.168.0.10')).toBe('192.168.0.10');
    expect(normalizeIp('  http://192.168.0.10/ ')).toBe('192.168.0.10');
    expect(normalizeIp('https://192.168.0.10/command?x=1')).toBe('192.168.0.10');
    expect(normalizeIp('192.168.0.10:8080')).toBe('192.168.0.10:8080');
    expect(normalizeIp('Danjos-Deck.local')).toBe('danjos-deck.local');
    expect(normalizeIp('http://host.local/')).toBe('host.local');
  });
  it('rejects invalid input', () => {
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp('   ')).toBeNull();
    expect(normalizeIp('999.1.1.1')).toBeNull();
    expect(normalizeIp('192.168.0')).toBeNull();
    expect(normalizeIp('not a host')).toBeNull();
    expect(normalizeIp('1.2.3.4:99999')).toBeNull();
    expect(normalizeIp('-bad.local')).toBeNull();
  });
});

describe('isMixedContentBlocked', () => {
  it('is false outside the browser', () => {
    expect(isMixedContentBlocked()).toBe(false);
  });
});
