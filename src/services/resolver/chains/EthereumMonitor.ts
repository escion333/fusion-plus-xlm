import { ethers } from 'ethers';
import { BaseMonitor, ResolverAccount } from './BaseMonitor';
import { ChainConfig } from '../../../config/chains';
import { EscrowEvent, EscrowImmutables } from '../../../types/swap';
import { logger } from '../utils/logger';
import { ESCROW_FACTORY_ABI, ESCROW_ABI } from '../../../contracts/abis';

export class EthereumMonitor extends BaseMonitor {
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;
  private escrowFactory?: ethers.Contract;

  constructor(chainConfig: ChainConfig, resolverAccount: ResolverAccount) {
    super(chainConfig, resolverAccount);
    
    this.provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    this.wallet = new ethers.Wallet(resolverAccount.privateKey, this.provider);
    
    if (chainConfig.escrowFactory) {
      this.escrowFactory = new ethers.Contract(
        chainConfig.escrowFactory,
        ESCROW_FACTORY_ABI,
        this.wallet
      );
    }
  }

  async start(): Promise<void> {
    logger.info(`Starting Ethereum monitor for ${this.chainConfig.name}`);
    
    // Test connection
    const network = await this.provider.getNetwork();
    logger.info(`Connected to ${this.chainConfig.name}, chainId: ${network.chainId}`);
    
    // Start polling
    await this.startPolling();
  }

  async stop(): Promise<void> {
    logger.info(`Stopping Ethereum monitor for ${this.chainConfig.name}`);
    await this.stopPolling();
  }

  async getLatestBlock(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  async processBlock(blockNumber: number): Promise<EscrowEvent[]> {
    const events: EscrowEvent[] = [];
    
    if (!this.escrowFactory) {
      return events;
    }

    // Get logs for this block
    const filter = {
      address: this.chainConfig.escrowFactory,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    };

    const logs = await this.provider.getLogs(filter);
    
    for (const log of logs) {
      try {
        const parsed = this.escrowFactory.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        if (parsed.name === 'EscrowCreated') {
          const escrowAddress = parsed.args.escrow;
          const immutables = await this.getEscrowImmutables(escrowAddress);
          
          events.push({
            type: 'EscrowCreated',
            chain: this.chainConfig.name,
            escrowAddress,
            orderHash: immutables.orderHash,
            timestamp: (await this.provider.getBlock(blockNumber))?.timestamp || 0,
            blockNumber,
            transactionHash: log.transactionHash,
            data: immutables,
          });
        }
      } catch (error) {
        logger.error('Error parsing log:', error);
      }
    }

    // Also check for escrow-specific events
    if (events.length > 0) {
      for (const event of events) {
        if (event.type === 'EscrowCreated') {
          await this.monitorEscrowEvents(event.escrowAddress, blockNumber);
        }
      }
    }

    return events;
  }

  private async monitorEscrowEvents(escrowAddress: string, blockNumber: number): Promise<void> {
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, this.provider);
    
    const filter = {
      address: escrowAddress,
      fromBlock: blockNumber,
      toBlock: blockNumber,
    };

    const logs = await this.provider.getLogs(filter);
    
    for (const log of logs) {
      try {
        const parsed = escrow.interface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });

        if (!parsed) continue;

        const baseEvent = {
          chain: this.chainConfig.name,
          escrowAddress,
          timestamp: (await this.provider.getBlock(blockNumber))?.timestamp || 0,
          blockNumber,
          transactionHash: log.transactionHash,
        };

        switch (parsed.name) {
          case 'SecretRevealed':
            this.emit('escrowEvent', {
              ...baseEvent,
              type: 'SecretRevealed',
              orderHash: parsed.args.orderHash,
              data: { secret: parsed.args.secret },
            });
            break;
            
          case 'EscrowCancelled':
            this.emit('escrowEvent', {
              ...baseEvent,
              type: 'EscrowCancelled',
              orderHash: parsed.args.orderHash,
              data: {},
            });
            break;
            
          case 'EscrowWithdrawn':
            this.emit('escrowEvent', {
              ...baseEvent,
              type: 'EscrowWithdrawn',
              orderHash: parsed.args.orderHash,
              data: { recipient: parsed.args.recipient },
            });
            break;
        }
      } catch (error) {
        logger.error('Error parsing escrow log:', error);
      }
    }
  }

  private async getEscrowImmutables(escrowAddress: string): Promise<EscrowImmutables> {
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, this.provider);
    
    const immutables = await escrow.immutables();
    
    return {
      orderHash: immutables.orderHash,
      hashlock: immutables.hashlock,
      maker: immutables.maker,
      taker: immutables.taker,
      token: immutables.token,
      amount: immutables.amount.toString(),
      safetyDeposit: immutables.safetyDeposit.toString(),
      timelocks: immutables.timelocks,
    };
  }

  async deployEscrow(params: any): Promise<string> {
    if (!this.escrowFactory) {
      throw new Error('Escrow factory not configured');
    }

    const tx = await this.escrowFactory.deploy(
      params.orderHash,
      params.hashlock,
      params.maker,
      params.taker,
      params.token,
      params.amount,
      params.safetyDeposit,
      params.timelocks
    );

    const receipt = await tx.wait();
    
    // Extract escrow address from event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = this.escrowFactory?.interface.parseLog(log);
        return parsed?.name === 'EscrowCreated';
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error('Escrow creation event not found');
    }

    const parsed = this.escrowFactory?.interface.parseLog(event);
    return parsed?.args.escrow;
  }

  async withdrawFromEscrow(escrowAddress: string, secret: string): Promise<string> {
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, this.wallet);
    
    const tx = await escrow.withdraw(secret, false);
    const receipt = await tx.wait();
    
    return receipt.hash;
  }

  async cancelEscrow(escrowAddress: string): Promise<string> {
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, this.wallet);
    
    const tx = await escrow.cancel();
    const receipt = await tx.wait();
    
    return receipt.hash;
  }

  async getEscrowState(escrowAddress: string): Promise<any> {
    const escrow = new ethers.Contract(escrowAddress, ESCROW_ABI, this.provider);
    
    const [state, immutables] = await Promise.all([
      escrow.state(),
      escrow.immutables(),
    ]);

    return {
      state,
      immutables,
      address: escrowAddress,
    };
  }
}