import { describe, expect, it, vi } from 'vitest';
import { createGuard, describeError } from './guard';

describe('error guard', () => {
  it('shows only the first error', () => {
    const show = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const g = createGuard(show);
    expect(g.tripped).toBe(false);
    g.trip(new Error('first'));
    g.trip(new Error('second'));
    expect(g.tripped).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('Error: first');
    spy.mockRestore();
  });

  it('never throws, even when showing fails', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const g = createGuard(() => {
      throw new Error('no DOM');
    });
    expect(() => g.trip('boom')).not.toThrow();
    expect(g.tripped).toBe(true);
    spy.mockRestore();
  });

  it('describes strings, objects and long errors on one short line', () => {
    expect(describeError('bad\n  thing')).toBe('bad thing');
    expect(describeError({ code: 7 })).toBe('{"code":7}');
    expect(describeError(undefined)).toBe('undefined');
    expect(describeError(new TypeError('x'.repeat(300))).length).toBe(158);
  });
});
