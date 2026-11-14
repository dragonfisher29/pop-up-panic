import { describe, expect, it } from 'vitest';
import { BLOCKLIST, isValidInitials } from './blocklist';

describe('isValidInitials', () => {
  it('accepts three clean uppercase letters', () => {
    expect(isValidInitials('NAD')).toBe(true);
    expect(isValidInitials('AAA')).toBe(true);
  });
  it('rejects wrong length', () => {
    expect(isValidInitials('AB')).toBe(false);
    expect(isValidInitials('ABCD')).toBe(false);
    expect(isValidInitials('')).toBe(false);
  });
  it('rejects lowercase, digits and symbols', () => {
    expect(isValidInitials('abc')).toBe(false);
    expect(isValidInitials('A1C')).toBe(false);
    expect(isValidInitials('A C')).toBe(false);
  });
  it('rejects every blocklisted word', () => {
    expect(BLOCKLIST.size).toBeGreaterThanOrEqual(40);
    for (const w of BLOCKLIST) {
      expect(w).toMatch(/^[A-Z]{3}$/);
      expect(isValidInitials(w)).toBe(false);
    }
  });
});
