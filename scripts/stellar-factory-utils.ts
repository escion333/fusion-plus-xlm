#!/usr/bin/env ts-node

import * as StellarSdk from 'stellar-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export class StellarFactoryUtils {
  private server: StellarSdk.SorobanRpc.Server;
  
  constructor(network: 'mainnet' | 'testnet' = 'mainnet') {
    const rpcUrl = network === 'mainnet' 
      ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
      : 'https://soroban-testnet.stellar.org';
    this.server = new StellarSdk.SorobanRpc.Server(rpcUrl);
  }

  /**
   * Calculate the deterministic address for an escrow
   */
  async calculateEscrowAddress(params: {
    factoryId: string;
    orderHash: string;
    hashlock: string;
    maker: string;
    taker: string;
    token: string;
    amount: string;
    safetyDeposit: string;
    timelocks: string;
  }) {
    const contract = new StellarSdk.Contract(params.factoryId);
    
    // Build the operation
    const operation = contract.call(
      'calculate_escrow_address',
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.orderHash, 'hex')),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.hashlock, 'hex')),
      new StellarSdk.Address(params.maker).toScVal(),
      new StellarSdk.Address(params.taker).toScVal(),
      new StellarSdk.Address(params.token).toScVal(),
      StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' })
    );

    // Simulate to get the address
    const sourceAccount = new StellarSdk.Account(
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      '0'
    );
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '100',
      networkPassphrase: StellarSdk.Networks.PUBLIC,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    try {
      const response = await this.server.simulateTransaction(transaction);
      
      if ('result' in response && response.result) {
        const resultVal = response.result.retval;
        const address = StellarSdk.Address.fromScVal(resultVal);
        return address.toString();
      }
      
      throw new Error('No result from simulation');
    } catch (error) {
      console.error('Error calculating escrow address:', error);
      throw error;
    }
  }

  /**
   * Deploy a new escrow through the factory
   */
  async deployEscrow(params: {
    factoryId: string;
    sourceKeypair: StellarSdk.Keypair;
    orderHash: string;
    hashlock: string;
    maker: string;
    taker: string;
    token: string;
    amount: string;
    safetyDeposit: string;
    timelocks: string;
  }) {
    const sourceAccount = await this.server.getAccount(params.sourceKeypair.publicKey());
    const contract = new StellarSdk.Contract(params.factoryId);
    
    const operation = contract.call(
      'deploy_escrow',
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.orderHash, 'hex')),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.hashlock, 'hex')),
      new StellarSdk.Address(params.maker).toScVal(),
      new StellarSdk.Address(params.taker).toScVal(),
      new StellarSdk.Address(params.token).toScVal(),
      StellarSdk.nativeToScVal(params.amount, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }),
      StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' })
    );

    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: '1000000', // Higher fee for contract deployment
      networkPassphrase: StellarSdk.Networks.PUBLIC,
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
      const response = await this.server.sendTransaction(preparedTx);
      
      // Wait for confirmation
      if (response.status === 'PENDING') {
        const result = await this.waitForTransaction(response.hash);
        if (result.status === 'SUCCESS') {
          // Extract the escrow address from the result
          const meta = result.resultMetaXdr;
          // Parse the address from the result
          return this.parseEscrowAddressFromResult(result);
        }
      }
      
      throw new Error(`Transaction failed: ${response.status}`);
    } catch (error) {
      console.error('Error deploying escrow:', error);
      throw error;
    }
  }

  private async waitForTransaction(hash: string, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await this.server.getTransaction(hash);
      if (response.status !== 'NOT_FOUND') {
        return response;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Transaction timeout');
  }

  private parseEscrowAddressFromResult(result: any): string {
    // Extract the contract address from the transaction result
    // This will need to parse the result meta to find the created contract
    // For now, return a placeholder
    throw new Error('Address parsing not yet implemented');
  }
}

// Example usage
if (require.main === module) {
  const factoryUtils = new StellarFactoryUtils('mainnet');
  
  // Example: Calculate escrow address
  const exampleParams = {
    factoryId: process.env.STELLAR_FACTORY_ID || 'YOUR_FACTORY_CONTRACT_ID',
    orderHash: '0000000000000000000000000000000000000000000000000000000000000001',
    hashlock: crypto.createHash('sha256').update('test_secret').digest('hex'),
    maker: 'GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4',
    taker: 'GBDEY4FVMRWRQC6A6J2UKSHFQVHZN2UISTHIXZ2D5O7OMSQVJL5VELSF',
    token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC', // Native XLM
    amount: '1000000000', // 100 XLM
    safetyDeposit: '100000000', // 10 XLM
    timelocks: '1234567890'
  };

  console.log('Calculating escrow address for:');
  console.log(JSON.stringify(exampleParams, null, 2));
  
  factoryUtils.calculateEscrowAddress(exampleParams)
    .then(address => {
      console.log('\nCalculated escrow address:', address);
    })
    .catch(error => {
      console.error('Error:', error);
    });
}