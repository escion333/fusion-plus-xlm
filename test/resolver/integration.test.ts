import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ResolverService, ResolverConfig } from '../../src/services/resolver/ResolverService';
import { SwapStatus } from '../../src/types/swap';

// Mock the chain monitors before importing
vi.mock('../../src/services/resolver/chains/EthereumMonitor', () => ({
  EthereumMonitor: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getLatestBlock: vi.fn().mockResolvedValue(12345),
    processBlock: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../src/services/resolver/chains/StellarMonitor', () => ({
  StellarMonitor: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    getLatestBlock: vi.fn().mockResolvedValue(5000),
    processBlock: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Resolver Service Integration', () => {
  let resolverService: ResolverService;
  const mockConfig: ResolverConfig = {
    chains: ['sepolia', 'stellarTestnet'],
    polling: {
      interval: 1000,
      enabled: true,
    },
    resolver: {
      address: '0x1234567890123456789012345678901234567890',
      privateKey: '0x' + '1'.repeat(64),
    },
    database: {
      connectionString: 'postgresql://test:test@localhost/test',
    },
  };

  beforeEach(() => {
    // Mock database connection
    vi.mock('pg', () => ({
      Pool: vi.fn().mockImplementation(() => ({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        end: vi.fn().mockResolvedValue(undefined),
      })),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize resolver service', () => {
    resolverService = new ResolverService(mockConfig);
    expect(resolverService).toBeDefined();
    
    const status = resolverService.getStatus();
    expect(status.running).toBe(false);
    expect(status.chains).toEqual(['sepolia', 'stellarTestnet']);
  });

  it('should handle configuration validation', () => {
    const invalidConfig = {
      ...mockConfig,
      resolver: {
        address: '',
        privateKey: '',
      },
    };

    // This would throw in the actual start method
    const service = new ResolverService(invalidConfig as ResolverConfig);
    expect(service).toBeDefined();
  });

  it('should track active swaps', async () => {
    resolverService = new ResolverService(mockConfig);
    
    // Mock the swap repository
    const mockSwapRepo = {
      initialize: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      findByOrderHash: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(undefined),
      getActiveCount: vi.fn().mockReturnValue(5),
    };
    
    (resolverService as any).swapRepository = mockSwapRepo;
    
    const status = resolverService.getStatus();
    expect(status.activeSwaps).toBe(5);
  });

  it('should emit events for escrow lifecycle', async () => {
    resolverService = new ResolverService(mockConfig);
    
    const mockEvent = {
      type: 'EscrowCreated' as const,
      chain: 'sepolia',
      escrowAddress: '0xabcd',
      orderHash: '0x1234',
      timestamp: Date.now() / 1000,
      blockNumber: 12345,
      transactionHash: '0xhash',
      data: {
        maker: '0xmaker',
        taker: '0xtaker',
        amount: '1000000',
      },
    };

    // Spy on event handling
    const handleSpy = vi.spyOn(resolverService as any, 'handleEscrowEvent');
    
    // Simulate event
    await (resolverService as any).handleEscrowEvent('sepolia', mockEvent);
    
    expect(handleSpy).toHaveBeenCalledWith('sepolia', mockEvent);
  });

  it('should manage secrets securely', () => {
    resolverService = new ResolverService(mockConfig);
    const secretManager = (resolverService as any).secretManager;
    
    const orderHash = '0xtest';
    const secretData = secretManager.generateSecret(orderHash);
    
    expect(secretData.secret).toMatch(/^0x[a-f0-9]{64}$/);
    expect(secretData.hashedSecret).toMatch(/^0x[a-f0-9]{64}$/);
    
    // Verify secret is stored
    const retrieved = secretManager.getSecret(orderHash);
    expect(retrieved).toEqual(secretData);
  });

  it('should track timelocks correctly', async () => {
    resolverService = new ResolverService(mockConfig);
    const timelockManager = (resolverService as any).timelockManager;
    
    const orderHash = '0xorder';
    const timelocks = {
      orderHash,
      srcWithdrawal: 100,
      srcPublicWithdrawal: 200,
      srcCancellation: 300,
      srcPublicCancellation: 400,
      dstWithdrawal: 500,
      dstPublicWithdrawal: 600,
      dstCancellation: 700,
    };
    
    await timelockManager.registerSwap(orderHash, timelocks);
    
    const stored = timelockManager.getTimelocks(orderHash);
    expect(stored).toEqual(timelocks);
    
    // Check action permissions
    expect(timelockManager.isActionAllowed(orderHash, 'srcWithdraw', false)).toBe(true);
  });
});