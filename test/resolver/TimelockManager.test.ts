import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TimelockManager } from '../../src/services/resolver/TimelockManager';

describe('TimelockManager', () => {
  let timelockManager: TimelockManager;
  let mockListener: any;

  beforeEach(() => {
    timelockManager = new TimelockManager();
    mockListener = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('registerSwap', () => {
    it('should register swap with unpacked timelocks', async () => {
      const orderHash = '0xtest123';
      // Create bit-packed timelocks (each timelock is 5 bytes = 40 bits)
      const timelocks = 
        (1000n << 0n) |   // srcWithdrawal
        (2000n << 40n) |  // srcPublicWithdrawal
        (3000n << 80n) |  // srcCancellation
        (4000n << 120n) | // srcPublicCancellation
        (5000n << 160n) | // dstWithdrawal
        (6000n << 200n) | // dstPublicWithdrawal
        (7000n << 240n);  // dstCancellation

      await timelockManager.registerSwap(orderHash, timelocks);
      
      const stored = timelockManager.getTimelocks(orderHash);
      expect(stored).toEqual({
        orderHash,
        srcWithdrawal: 1000,
        srcPublicWithdrawal: 2000,
        srcCancellation: 3000,
        srcPublicCancellation: 4000,
        dstWithdrawal: 5000,
        dstPublicWithdrawal: 6000,
        dstCancellation: 7000,
      });
    });

    it('should register swap with timelock object', async () => {
      const timelockData = {
        orderHash: '0xtest456',
        srcWithdrawal: 100,
        srcPublicWithdrawal: 200,
        srcCancellation: 300,
        srcPublicCancellation: 400,
        dstWithdrawal: 500,
        dstPublicWithdrawal: 600,
        dstCancellation: 700,
      };

      await timelockManager.registerSwap(timelockData.orderHash, timelockData);
      
      const stored = timelockManager.getTimelocks(timelockData.orderHash);
      expect(stored).toEqual(timelockData);
    });
  });

  describe('timelock expiration events', () => {
    it('should emit event when timelock expires', async () => {
      timelockManager.on('timelockExpired', mockListener);
      
      const now = Math.floor(Date.now() / 1000);
      const timelockData = {
        orderHash: '0xexpire',
        srcWithdrawal: now - 100,
        srcPublicWithdrawal: now + 100, // 100 seconds in future
        srcCancellation: now - 50,
        srcPublicCancellation: now - 10,
        dstWithdrawal: now - 200,
        dstPublicWithdrawal: now + 200,
        dstCancellation: now + 300,
      };

      await timelockManager.start();
      await timelockManager.registerSwap(timelockData.orderHash, timelockData);
      
      // Fast forward time to trigger expiration
      vi.advanceTimersByTime(101 * 1000);
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          orderHash: '0xexpire',
          timelockType: 'srcPublicWithdrawal',
        })
      );
    });
  });

  describe('isActionAllowed', () => {
    it('should check if withdrawal is allowed', () => {
      const now = Math.floor(Date.now() / 1000);
      const orderHash = '0xallow';
      const timelockData = {
        orderHash,
        srcWithdrawal: now - 100,
        srcPublicWithdrawal: now + 100,
        srcCancellation: now + 200,
        srcPublicCancellation: now + 300,
        dstWithdrawal: now - 50,
        dstPublicWithdrawal: now + 150,
        dstCancellation: now + 250,
      };

      timelockManager.registerSwap(orderHash, timelockData);
      
      // Source withdrawal allowed (past timelock)
      expect(timelockManager.isActionAllowed(orderHash, 'srcWithdraw', false)).toBe(true);
      
      // Source public withdrawal not allowed yet
      expect(timelockManager.isActionAllowed(orderHash, 'srcWithdraw', true)).toBe(false);
      
      // Destination withdrawal allowed
      expect(timelockManager.isActionAllowed(orderHash, 'dstWithdraw', false)).toBe(true);
      
      // Cancellation not allowed yet
      expect(timelockManager.isActionAllowed(orderHash, 'srcCancel', false)).toBe(false);
    });
  });

  describe('removeSwap', () => {
    it('should remove swap and clear timers', async () => {
      const orderHash = '0xremove';
      await timelockManager.registerSwap(orderHash, {
        orderHash,
        srcWithdrawal: 100,
        srcPublicWithdrawal: 200,
        srcCancellation: 300,
        srcPublicCancellation: 400,
        dstWithdrawal: 500,
        dstPublicWithdrawal: 600,
        dstCancellation: 700,
      });
      
      expect(timelockManager.getTimelocks(orderHash)).toBeDefined();
      
      timelockManager.removeSwap(orderHash);
      
      expect(timelockManager.getTimelocks(orderHash)).toBeUndefined();
    });
  });

  describe('getTimelockCount', () => {
    it('should return correct count', async () => {
      expect(timelockManager.getTimelockCount()).toBe(0);
      
      await timelockManager.registerSwap('0x1', 1000n);
      await timelockManager.registerSwap('0x2', 2000n);
      
      expect(timelockManager.getTimelockCount()).toBe(2);
      
      timelockManager.removeSwap('0x1');
      
      expect(timelockManager.getTimelockCount()).toBe(1);
    });
  });
});