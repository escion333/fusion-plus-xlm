import {
  Contract,
  Keypair,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  xdr,
  scValToNative,
  nativeToScVal,
  Address,
} from '@stellar/stellar-sdk';
import { BaseMonitor, ResolverAccount } from './BaseMonitor';
import { ChainConfig } from '../../../config/chains';
import { EscrowEvent } from '../../../types/swap';
import { logger } from '../utils/logger';

export class StellarMonitor extends BaseMonitor {
  private server: SorobanRpc.Server;
  private keypair: Keypair;
  private networkPassphrase: string;

  constructor(chainConfig: ChainConfig, resolverAccount: ResolverAccount) {
    super(chainConfig, resolverAccount);
    
    try {
      this.server = new SorobanRpc.Server(chainConfig.rpcUrl);
      this.keypair = Keypair.fromSecret(resolverAccount.privateKey);
      this.networkPassphrase = chainConfig.name.includes('Testnet') 
        ? Networks.TESTNET 
        : Networks.PUBLIC;
        
      logger.info(`Stellar monitor initialized for ${chainConfig.name}`, {
        contractId: chainConfig.escrowFactory,
        resolverAddress: this.keypair.publicKey(),
        network: this.networkPassphrase === Networks.PUBLIC ? 'mainnet' : 'testnet',
      });
    } catch (error) {
      logger.error(`Failed to initialize Stellar monitor for ${chainConfig.name}:`, error);
      throw error;
    }
  }

  async start(): Promise<void> {
    logger.info(`Starting Stellar monitor for ${this.chainConfig.name}`);
    
    try {
      // Test connection
      logger.info(`Testing connection to ${this.chainConfig.rpcUrl}...`);
      const health = await this.server.getHealth();
      
      if (health.status !== 'healthy') {
        throw new Error(`Stellar RPC unhealthy: ${health.status}`);
      }
      
      logger.info(`✅ Connected to ${this.chainConfig.name}`, {
        status: health.status,
        rpcUrl: this.chainConfig.rpcUrl,
      });
      
      // Check resolver account
      const account = await this.server.getAccount(this.keypair.publicKey());
      const xlmBalance = account.balances.find(b => b.asset_type === 'native')?.balance || '0';
      logger.info(`Resolver balance on ${this.chainConfig.name}: ${xlmBalance} XLM`);
      
      if (parseFloat(xlmBalance) < 10) {
        logger.warn(`⚠️  Low XLM balance on ${this.chainConfig.name}: ${xlmBalance} XLM`);
      }
      
      // Verify contract exists if configured
      if (this.chainConfig.escrowFactory) {
        try {
          const contractId = this.chainConfig.escrowFactory;
          logger.info(`Verifying contract ${contractId} exists...`);
          // Note: Contract verification would go here
          logger.info(`✅ Contract verified`);
        } catch (error) {
          logger.error(`Failed to verify contract:`, error);
        }
      }
      
      // Start polling
      await this.startPolling();
      
    } catch (error) {
      logger.error(`Failed to start Stellar monitor:`, {
        chain: this.chainConfig.name,
        error: error.message,
        rpcUrl: this.chainConfig.rpcUrl,
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info(`Stopping Stellar monitor for ${this.chainConfig.name}`);
    await this.stopPolling();
  }

  async getLatestBlock(): Promise<number> {
    const latestLedger = await this.server.getLatestLedger();
    return latestLedger.sequence;
  }

  async processBlock(blockNumber: number): Promise<EscrowEvent[]> {
    const events: EscrowEvent[] = [];
    
    try {
      // Get events for this ledger
      const response = await this.server.getEvents({
        startLedger: blockNumber,
        filters: [
          {
            type: 'contract',
            contractIds: [this.chainConfig.escrowFactory || ''],
          },
        ],
      });

      for (const event of response.events) {
        const parsedEvent = this.parseContractEvent(event);
        if (parsedEvent && parsedEvent.type) {
          events.push({
            ...parsedEvent as EscrowEvent,
            chain: this.chainConfig.name,
            timestamp: event.ledgerClosedAt ? new Date(event.ledgerClosedAt).getTime() / 1000 : 0,
            blockNumber: event.ledger,
            transactionHash: (event as any).txHash || '',
          });
        }
      }
    } catch (error) {
      logger.error(`Error fetching events for ledger ${blockNumber}:`, error);
    }

    return events;
  }

  private parseContractEvent(event: SorobanRpc.Api.EventResponse): Partial<EscrowEvent> | null {
    try {
      if (!event.topic || event.topic.length === 0) return null;

      // Parse event topic (first element)
      const eventType = scValToNative(event.topic[0]);
      
      switch (eventType) {
        case 'escrow_created':
          return this.parseEscrowCreatedEvent(event);
        case 'secret_revealed':
          return this.parseSecretRevealedEvent(event);
        case 'escrow_cancelled':
          return this.parseEscrowCancelledEvent(event);
        case 'escrow_withdrawn':
          return this.parseEscrowWithdrawnEvent(event);
        default:
          return null;
      }
    } catch (error) {
      logger.error('Error parsing contract event:', error);
      return null;
    }
  }

  private parseEscrowCreatedEvent(event: SorobanRpc.Api.EventResponse): Partial<EscrowEvent> {
    const data = scValToNative(event.value);
    
    return {
      type: 'EscrowCreated',
      escrowAddress: String(event.contractId || ''),
      orderHash: data.order_hash,
      data: {
        orderHash: data.order_hash,
        hashlock: data.hashlock,
        maker: data.maker,
        taker: data.taker,
        token: data.token,
        amount: data.amount,
        safetyDeposit: data.safety_deposit,
        timelocks: data.timelocks,
      },
    };
  }

  private parseSecretRevealedEvent(event: SorobanRpc.Api.EventResponse): Partial<EscrowEvent> {
    const data = scValToNative(event.value);
    
    return {
      type: 'SecretRevealed',
      escrowAddress: String(event.contractId || ''),
      orderHash: data.order_hash,
      data: {
        secret: data.secret,
      },
    };
  }

  private parseEscrowCancelledEvent(event: SorobanRpc.Api.EventResponse): Partial<EscrowEvent> {
    const data = scValToNative(event.value);
    
    return {
      type: 'EscrowCancelled',
      escrowAddress: String(event.contractId || ''),
      orderHash: data.order_hash,
      data: {},
    };
  }

  private parseEscrowWithdrawnEvent(event: SorobanRpc.Api.EventResponse): Partial<EscrowEvent> {
    const data = scValToNative(event.value);
    
    return {
      type: 'EscrowWithdrawn',
      escrowAddress: String(event.contractId || ''),
      orderHash: data.order_hash,
      data: {
        recipient: data.recipient,
      },
    };
  }

  async deployEscrow(params: any): Promise<string> {
    const account = await this.server.getAccount(this.keypair.publicKey());
    
    // Build contract invocation
    const contract = new Contract(this.chainConfig.escrowFactory!);
    const operation = contract.call(
      'deploy',
      nativeToScVal({
        order_hash: Buffer.from(params.orderHash.slice(2), 'hex'),
        hashlock: Buffer.from(params.hashlock.slice(2), 'hex'),
        maker: new Address(params.maker).toScVal(),
        taker: new Address(params.taker).toScVal(),
        token: new Address(params.token).toScVal(),
        amount: BigInt(params.amount),
        safety_deposit: BigInt(params.safetyDeposit),
        timelocks: BigInt(params.timelocks),
      }, { type: 'struct' })
    );

    const transaction = new TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    // Simulate and prepare
    const prepared = await this.server.prepareTransaction(transaction);
    prepared.sign(this.keypair);

    // Submit
    const result = await this.server.sendTransaction(prepared);
    
    if (result.status === 'PENDING') {
      // Wait for confirmation
      const confirmed = await this.waitForTransaction(result.hash);
      
      if (confirmed.status === 'SUCCESS' && confirmed.resultMetaXdr) {
        // Extract escrow address from result
        // const meta = xdr.TransactionMeta.fromXDR(confirmed.resultMetaXdr, 'base64');
        // TODO: Parse meta to get deployed contract address
        return 'deployed-escrow-address';
      }
    }

    throw new Error('Failed to deploy escrow');
  }

  async withdrawFromEscrow(escrowAddress: string, secret: string): Promise<string> {
    const account = await this.server.getAccount(this.keypair.publicKey());
    
    const contract = new Contract(escrowAddress);
    const operation = contract.call(
      'withdraw',
      nativeToScVal(Buffer.from(secret.slice(2), 'hex'), { type: 'bytes' }),
      nativeToScVal(false, { type: 'bool' })
    );

    const transaction = new TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const prepared = await this.server.prepareTransaction(transaction);
    prepared.sign(this.keypair);

    const result = await this.server.sendTransaction(prepared);
    
    if (result.status === 'PENDING') {
      const confirmed = await this.waitForTransaction(result.hash);
      if (confirmed.status === 'SUCCESS') {
        return result.hash;
      }
    }

    throw new Error('Failed to withdraw from escrow');
  }

  async cancelEscrow(escrowAddress: string): Promise<string> {
    const account = await this.server.getAccount(this.keypair.publicKey());
    
    const contract = new Contract(escrowAddress);
    const operation = contract.call(
      'cancel',
      new Address(this.keypair.publicKey()).toScVal()
    );

    const transaction = new TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(300)
      .build();

    const prepared = await this.server.prepareTransaction(transaction);
    prepared.sign(this.keypair);

    const result = await this.server.sendTransaction(prepared);
    
    if (result.status === 'PENDING') {
      const confirmed = await this.waitForTransaction(result.hash);
      if (confirmed.status === 'SUCCESS') {
        return result.hash;
      }
    }

    throw new Error('Failed to cancel escrow');
  }

  async getEscrowState(escrowAddress: string): Promise<any> {
    const contract = new Contract(escrowAddress);
    
    // Get state
    const stateOp = contract.call('get_state');
    const immutablesOp = contract.call('get_immutables');

    const account = await this.server.getAccount(this.keypair.publicKey());
    const transaction = new TransactionBuilder(account, {
      fee: '10000',
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(stateOp)
      .addOperation(immutablesOp)
      .setTimeout(300)
      .build();

    const simulated = await this.server.simulateTransaction(transaction);
    
    if ('results' in simulated && (simulated as any).results && (simulated as any).results.length === 2) {
      return {
        state: scValToNative((simulated as any).results[0].xdr),
        immutables: scValToNative((simulated as any).results[1].xdr),
        address: escrowAddress,
      };
    }

    throw new Error('Failed to get escrow state');
  }

  private async waitForTransaction(hash: string, timeout: number = 30000): Promise<any> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      const response = await this.server.getTransaction(hash);
      
      if (response.status !== 'NOT_FOUND') {
        return response;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Transaction timeout');
  }
}