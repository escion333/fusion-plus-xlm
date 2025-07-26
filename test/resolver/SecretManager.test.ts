import { describe, it, expect, beforeEach } from 'vitest';
import { SecretManager } from '../../src/services/resolver/SecretManager';

describe('SecretManager', () => {
  let secretManager: SecretManager;

  beforeEach(() => {
    secretManager = new SecretManager();
  });

  describe('generateSecret', () => {
    it('should generate a valid secret', () => {
      const orderHash = '0x1234567890abcdef';
      const secretData = secretManager.generateSecret(orderHash);

      expect(secretData.orderHash).toBe(orderHash);
      expect(secretData.secret).toMatch(/^0x[a-f0-9]{64}$/);
      expect(secretData.hashedSecret).toMatch(/^0x[a-f0-9]{64}$/);
      expect(secretData.createdAt).toBeInstanceOf(Date);
      expect(secretData.revealedAt).toBeUndefined();
    });

    it('should store the generated secret', () => {
      const orderHash = '0x1234567890abcdef';
      secretManager.generateSecret(orderHash);
      
      const retrieved = secretManager.getSecret(orderHash);
      expect(retrieved).toBeDefined();
      expect(retrieved?.orderHash).toBe(orderHash);
    });
  });

  describe('hashSecret', () => {
    it('should hash a secret correctly', () => {
      const secret = '0x' + '1'.repeat(64);
      const hash = secretManager.hashSecret(secret);
      
      expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
      // Known hash for all 1s
      expect(hash).toBe('0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc');
    });

    it('should handle secrets without 0x prefix', () => {
      const secret = '1'.repeat(64);
      const hash = secretManager.hashSecret(secret);
      
      expect(hash).toBe('0x02d449a31fbb267c8f352e9968a79e3e5fc95c1bbeaa502fd6454ebde5a4bedc');
    });
  });

  describe('generatePartialFillSecrets', () => {
    it('should generate N+1 secrets for N parts', () => {
      const orderHash = '0xabcdef';
      const parts = 3;
      const secrets = secretManager.generatePartialFillSecrets(orderHash, parts);
      
      expect(secrets).toHaveLength(4); // N+1
      
      secrets.forEach((secret, index) => {
        expect(secret.orderHash).toBe(`${orderHash}-part-${index}`);
        expect(secret.secret).toMatch(/^0x[a-f0-9]{64}$/);
      });
    });
  });

  describe('storeRevealedSecret', () => {
    it('should update existing secret with reveal time', () => {
      const orderHash = '0x1234';
      secretManager.generateSecret(orderHash);
      
      const before = secretManager.getSecret(orderHash);
      expect(before?.revealedAt).toBeUndefined();
      
      secretManager.storeRevealedSecret(orderHash, before!.secret);
      
      const after = secretManager.getSecret(orderHash);
      expect(after?.revealedAt).toBeInstanceOf(Date);
    });

    it('should store new revealed secret from external source', () => {
      const orderHash = '0x5678';
      const externalSecret = '0x' + '2'.repeat(64);
      
      secretManager.storeRevealedSecret(orderHash, externalSecret);
      
      const stored = secretManager.getSecret(orderHash);
      expect(stored?.secret).toBe(externalSecret);
      expect(stored?.revealedAt).toBeInstanceOf(Date);
    });
  });

  describe('shouldRevealSecret', () => {
    it('should return true when past reveal time', () => {
      const orderHash = '0xtest';
      secretManager.generateSecret(orderHash);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealTime = currentTime - 100; // 100 seconds ago
      
      expect(secretManager.shouldRevealSecret(orderHash, currentTime, revealTime)).toBe(true);
    });

    it('should return false when before reveal time', () => {
      const orderHash = '0xtest';
      secretManager.generateSecret(orderHash);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealTime = currentTime + 100; // 100 seconds in future
      
      expect(secretManager.shouldRevealSecret(orderHash, currentTime, revealTime)).toBe(false);
    });

    it('should return false for already revealed secret', () => {
      const orderHash = '0xtest';
      const secretData = secretManager.generateSecret(orderHash);
      secretManager.storeRevealedSecret(orderHash, secretData.secret);
      
      const currentTime = Math.floor(Date.now() / 1000);
      const revealTime = currentTime - 100;
      
      expect(secretManager.shouldRevealSecret(orderHash, currentTime, revealTime)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should remove old revealed secrets', () => {
      const orderHash1 = '0x1111';
      const orderHash2 = '0x2222';
      
      const secret1 = secretManager.generateSecret(orderHash1);
      const secret2 = secretManager.generateSecret(orderHash2);
      
      // Reveal only the first secret
      secretManager.storeRevealedSecret(orderHash1, secret1.secret);
      
      // Cleanup with future date (all secrets are old)
      const futureDate = new Date(Date.now() + 1000000);
      secretManager.cleanup(futureDate);
      
      // Only revealed secret should be removed
      expect(secretManager.getSecret(orderHash1)).toBeUndefined();
      expect(secretManager.getSecret(orderHash2)).toBeDefined();
    });
  });

  describe('getSecretCount', () => {
    it('should count secrets correctly', () => {
      expect(secretManager.getSecretCount()).toEqual({
        total: 0,
        revealed: 0,
        pending: 0,
      });
      
      // Generate some secrets
      secretManager.generateSecret('0x1');
      secretManager.generateSecret('0x2');
      secretManager.generateSecret('0x3');
      
      expect(secretManager.getSecretCount()).toEqual({
        total: 3,
        revealed: 0,
        pending: 3,
      });
      
      // Reveal one
      const secret = secretManager.getSecret('0x1');
      secretManager.storeRevealedSecret('0x1', secret!.secret);
      
      expect(secretManager.getSecretCount()).toEqual({
        total: 3,
        revealed: 1,
        pending: 2,
      });
    });
  });
});