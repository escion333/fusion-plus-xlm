import * as StellarSdk from 'stellar-sdk';
import { rpc } from 'stellar-sdk';
import { getStellarContracts } from '../../config/stellar-contracts';
import { logger } from '../resolver/utils/logger';
import { confirmTx } from '../../utils/stellarConfirm';
import { ethers } from 'ethers';

export interface EscrowParams {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: string;
}

export class StellarFactoryService {
  private server: rpc.Server;
  private factoryId: string;
  private network: 'mainnet' | 'testnet';

  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    this.network = network;
    const contracts = getStellarContracts(network);
    
    if (!contracts.factory) {
      throw new Error(`Factory contract not configured for ${network}. Please set STELLAR_FACTORY_${network.toUpperCase()} environment variable.`);
    }
    
    this.factoryId = contracts.factory;
    
    const rpcUrl = network === 'mainnet' 
      ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
      : 'https://soroban-testnet.stellar.org';
    
    this.server = new rpc.Server(rpcUrl);
  }

  /**
   * Calculate the deterministic address for an escrow
   */
  async calculateEscrowAddress(params: EscrowParams): Promise<string> {
    console.log('🔮 Calculating escrow address for params:', params);
    
    const contract = new StellarSdk.Contract(this.factoryId);
    
    // Compute salt client-side using keccak256
    // Simply concatenate all parameters as hex (remove 0x prefixes)
    const orderHashHex = params.orderHash.startsWith('0x') ? params.orderHash.slice(2) : params.orderHash;
    const hashlockHex = params.hashlock.startsWith('0x') ? params.hashlock.slice(2) : params.hashlock;
    
    const saltInput = 
      orderHashHex +
      hashlockHex +
      Buffer.from(params.maker).toString('hex') +
      Buffer.from(params.taker).toString('hex') +
      Buffer.from(params.token).toString('hex') +
      BigInt(params.amount).toString(16).padStart(32, '0') +
      BigInt(params.safetyDeposit).toString(16).padStart(32, '0') +
      BigInt(params.timelocks).toString(16).padStart(16, '0');
    
    const salt = ethers.keccak256('0x' + saltInput).slice(2); // Remove 0x prefix
    
    // Build the operation with all parameters (old interface)
    const operation = contract.call(
      'calculate_escrow_address',
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(orderHashHex, 'hex')),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(hashlockHex, 'hex')),
      StellarSdk.Address.fromString(params.maker).toScVal(),
      StellarSdk.Address.fromString(params.taker).toScVal(),
      StellarSdk.Address.fromString(params.token).toScVal(),
      StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' })
    );

    // Create a dummy source account for simulation
    const sourceAccount = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );
    
    const networkPassphrase = this.network === 'mainnet' 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    try {
      const response = await this.server.simulateTransaction(transaction);
      
      if (rpc.Api.isSimulationSuccess(response)) {
        const result = response.result;
        if (result && result.retval) {
          const address = StellarSdk.Address.fromScVal(result.retval);
          console.log('✅ Calculated escrow address:', address.toString());
          return address.toString();
        }
      }
      
      throw new Error('Failed to calculate escrow address: ' + JSON.stringify(response));
    } catch (error) {
      console.error('❌ Error calculating escrow address:', error);
      throw error;
    }
  }

  /**
   * Deploy a new escrow through the factory
   */
  async deployEscrow(params: EscrowParams & { sourceKeypair: StellarSdk.Keypair }): Promise<string> {
    console.log('🚀 Deploying escrow with params:', {
      ...params,
      sourceKeypair: params.sourceKeypair.publicKey()
    });
    
    const sourceAccount = await this.server.getAccount(params.sourceKeypair.publicKey());
    const contract = new StellarSdk.Contract(this.factoryId);
    
    // Compute salt client-side using keccak256
    // Simply concatenate all parameters as hex (remove 0x prefixes)
    const orderHashHex = params.orderHash.startsWith('0x') ? params.orderHash.slice(2) : params.orderHash;
    const hashlockHex = params.hashlock.startsWith('0x') ? params.hashlock.slice(2) : params.hashlock;
    
    const saltInput = 
      orderHashHex +
      hashlockHex +
      Buffer.from(params.maker).toString('hex') +
      Buffer.from(params.taker).toString('hex') +
      Buffer.from(params.token).toString('hex') +
      BigInt(params.amount).toString(16).padStart(32, '0') +
      BigInt(params.safetyDeposit).toString(16).padStart(32, '0') +
      BigInt(params.timelocks).toString(16).padStart(16, '0');
    
    const salt = ethers.keccak256('0x' + saltInput).slice(2); // Remove 0x prefix
    
    const operation = contract.call(
      'deploy_escrow',
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(orderHashHex, 'hex')),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(hashlockHex, 'hex')),
      StellarSdk.Address.fromString(params.maker).toScVal(),
      StellarSdk.Address.fromString(params.taker).toScVal(),
      StellarSdk.Address.fromString(params.token).toScVal(),
      StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' })
    );

    const networkPassphrase = this.network === 'mainnet' 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '1000000', // Higher fee for contract deployment
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(180)
      .build();

    try {
      // Prepare transaction
      const preparedTx = await this.server.prepareTransaction(transaction);
      
      // Sign transaction
      preparedTx.sign(params.sourceKeypair);
      
      // Submit transaction
      console.log('📤 Submitting transaction...');
      const response = await this.server.sendTransaction(preparedTx);
      
      // Wait for confirmation
      if (response.status === 'PENDING') {
        console.log('⏳ Waiting for confirmation...');
        const result = await this.waitForTransaction(response.hash);
        
        if (result.status === 'SUCCESS' && result.resultMetaXdr) {
          // Extract the escrow address from the result
          const escrowAddress = await this.parseEscrowAddressFromResult(result);
          console.log('✅ Escrow deployed at:', escrowAddress);
          
          // --- AUTO-FUND -------------------------------------------------
          const contracts = getStellarContracts(this.network);
          const usdc = contracts.usdc;
          const amount = params.amount.toString(); // i128 string
          
          if (usdc) {
            try {
              console.log("🌐 Funding HTLC with", amount, "USDC");
              await this.fund(escrowAddress, amount, usdc, params.sourceKeypair);
              console.log("✅ HTLC funded");
            } catch (e: any) {
              console.error("⚠️  Auto-fund failed:", e.message);
              throw e; // bubble up so swap aborts atomically
            }
          } else {
            console.warn("⚠️  USDC contract not configured, skipping auto-fund");
          }
          
          return escrowAddress;
        } else {
          throw new Error(`Transaction failed with status: ${result.status}`);
        }
      }
      
      throw new Error(`Transaction submission failed: ${response.status}`);
    } catch (error) {
      console.error('❌ Error deploying escrow:', error);
      throw error;
    }
  }

  /**
   * Fund an HTLC escrow with tokens using transfer operation
   */
  async fund(escrowAddress: string, amount: string, tokenAddress: string, sourceKeypair: StellarSdk.Keypair): Promise<void> {
    console.log('💰 Funding escrow with token transfer:', {
      escrow: escrowAddress,
      amount,
      token: tokenAddress,
      from: sourceKeypair.publicKey()
    });

    const sourceAccount = await this.server.getAccount(sourceKeypair.publicKey());
    const tokenContract = new StellarSdk.Contract(tokenAddress);

    const operation = tokenContract.call(
      'transfer',
      StellarSdk.Address.fromString(sourceKeypair.publicKey()).toScVal(),
      StellarSdk.Address.fromString(escrowAddress).toScVal(),
      StellarSdk.nativeToScVal(amount, { type: 'i128' })
    );

    const networkPassphrase = this.network === 'mainnet' 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '500000', // Standard fee for token transfer
      networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(180)
      .build();

    try {
      // Prepare transaction
      const preparedTx = await this.server.prepareTransaction(transaction);
      
      // Sign transaction
      preparedTx.sign(sourceKeypair);
      
      // Submit transaction
      console.log('📤 Submitting fund transaction...');
      const response = await this.server.sendTransaction(preparedTx);
      
      // Wait for confirmation
      if (response.status === 'PENDING') {
        console.log('⏳ Waiting for funding confirmation...');
        const result = await this.waitForTransaction(response.hash);
        
        if (result.status === 'SUCCESS') {
          console.log('✅ Escrow funded successfully');
        } else {
          throw new Error(`Funding transaction failed with status: ${result.status}`);
        }
      } else {
        throw new Error(`Funding transaction submission failed: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Error funding escrow:', error);
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(hash: string, maxAttempts = 30): Promise<rpc.Api.GetTransactionResponse> {
    try {
      for (let i = 0; i < maxAttempts; i++) {
        const response = await this.server.getTransaction(hash);
        if (response.status !== 'NOT_FOUND') {
          return response;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      throw new Error('Transaction timeout');
    } catch (error) {
      if (error instanceof Error && /xdr|Bad union switch/i.test(error.message)) {
        console.warn('SDK XDR parse failed, falling back to direct RPC poll');
        await confirmTx(hash);
        // Return a mock success response since we confirmed via RPC
        return {
          status: 'SUCCESS',
          hash,
          ledger: 0,
          createdAt: Date.now(),
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: '',
          resultXdr: '',
          resultMetaXdr: '',
        } as any;
      }
      throw error;
    }
  }

  /**
   * Parse escrow address from transaction result
   */
  private async parseEscrowAddressFromResult(result: rpc.Api.GetSuccessfulTransactionResponse): Promise<string> {
    // The deploy_escrow function returns the address directly
    if (result.returnValue) {
      const address = StellarSdk.Address.fromScVal(result.returnValue);
      return address.toString();
    }
    
    // Fallback: look for contract creation in the meta
    if (result.resultMetaXdr) {
      try {
        // XDR parsing would go here, but for now we'll use a deterministic approach
        logger.warn('Using deterministic address generation as fallback');
      } catch (error) {
        logger.error('Failed to parse XDR meta:', error);
      }
    }
    
    throw new Error('No escrow address found in transaction result');
  }

  /**
   * Get factory contract ID
   */
  getFactoryId(): string {
    return this.factoryId;
  }

  /**
   * Check if factory is available
   */
  isAvailable(): boolean {
    return !!this.factoryId;
  }
}