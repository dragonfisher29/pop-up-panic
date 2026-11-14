import { describe, expect, it } from 'vitest';
import { prompts, SYSTEM } from './copy';

describe('prompts', () => {
  it('desktop keeps the keyboard lines', () => {
    expect(prompts(false).titlePrompt).toBe(SYSTEM.titlePrompt);
    expect(prompts(false).pickerHint).toBe(SYSTEM.pickerHint);
  });

  it('touch never asks for a key', () => {
    for (const line of Object.values(prompts(true))) {
      expect(line).not.toMatch(/\bkey\b|Enter|Press|↑|←/);
    }
  });
});
