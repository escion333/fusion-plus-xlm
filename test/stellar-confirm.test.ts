import { describe, it, expect } from 'vitest';
import { confirmTx } from '../src/utils/stellarConfirm';

describe('stellar confirmation', () => {
  it('confirmTx resolves for known hash on pubnet', async () => {
    // Using the actual transaction hash from our previous attempt
    await expect(confirmTx('3b5b8935203e331b3dff64233485072ba3181266d5d66ebcf43fc3052fed006d')).resolves.not.toThrow();
  });
});