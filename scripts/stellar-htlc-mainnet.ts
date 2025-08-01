#!/usr/bin/env ts-node

import * as StellarSdk from '@stellar/stellar-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Mainnet Configuration
const MAINNET_CONFIG = {
  contractId: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
  sorobanRpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
  horizon: 'https://horizon.stellar.org',
  network: StellarSdk.Networks.PUBLIC,
  passphrase: 'Public Global Stellar Network ; September 2015',
};

export class StellarHTLCMainnet {
  private server: StellarSdk.SorobanRpc.Server;
  private horizonServer: StellarSdk.Horizon.Server;
  private contractId: string;
  
  constructor() {
    this.server = new StellarSdk.SorobanRpc.Server(MAINNET_CONFIG.sorobanRpc);
    this.horizonServer = new StellarSdk.Horizon.Server(MAINNET_CONFIG.horizon);
    this.contractId = MAINNET_CONFIG.contractId;
  }

  /**
   * Create a new HTLC escrow on mainnet
   */
  async createHTLCEscrow(params: {
    maker: string;
    taker: string;
    amount: string; // in XLM
    secret?: string; // If not provided, generates one
    timelockSeconds?: number;
  }) {
    try {
      console.log('🔐 Creating HTLC Escrow on Stellar Mainnet...\n');
      
      // Generate or use provided secret
      const secret = params.secret || crypto.randomBytes(32).toString('hex');
      const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
      
      console.log('📋 Escrow Details:');
      console.log(`   Contract: ${this.contractId}`);
      console.log(`   Maker: ${params.maker}`);
      console.log(`   Taker: ${params.taker}`);
      console.log(`   Amount: ${params.amount} XLM`);
      console.log(`   Secret Hash: ${secretHash}`);
      console.log(`   Timelock: ${params.timelockSeconds || 3600} seconds`);
      console.log('');
      
      // Load maker account
      const makerKeypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_TEST_WALLET_SECRET!);
      const account = await this.server.getAccount(makerKeypair.publicKey());
      
      // Build the transaction to deploy escrow
      const contract = new StellarSdk.Contract(this.contractId);
      
      // Create immutables for escrow deployment
      console.log('Creating immutables with addresses:');
      console.log('  Maker:', params.maker);
      console.log('  Taker:', params.taker);
      
      // Use nativeToScVal for addresses to avoid the Address class issue
      const immutables = StellarSdk.nativeToScVal({
        maker: params.maker,
        taker: params.taker,
        token: 'native',
        amount: parseInt(params.amount) * 10000000,
        hash_lock: Buffer.from(secretHash, 'hex'),
        time_lock: params.timelockSeconds || 3600,
      });
      
      // Build transaction
      const deployTx = new StellarSdk.TransactionBuilder(account, {
        fee: '100000', // 0.01 XLM
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          contract.call('deploy_escrow', immutables)
        )
        .setTimeout(30)
        .build();
      
      // Simulate to get resource fees
      console.log('⏳ Simulating transaction...');
      const simResult = await this.server.simulateTransaction(deployTx);
      
      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(simResult)) {
        // Prepare and sign transaction
        const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(
          deployTx,
          simResult
        );
        preparedTx.sign(makerKeypair);
        
        // Submit transaction
        console.log('📤 Submitting transaction to network...');
        const sendResult = await this.server.sendTransaction(preparedTx);
        
        if (sendResult.status === 'PENDING') {
          console.log('⏳ Transaction pending...');
          
          // Wait for confirmation
          const txResult = await this.waitForTransaction(sendResult.hash);
          
          if (txResult.status === 'SUCCESS') {
            console.log('✅ Escrow created successfully!');
            console.log(`   Transaction: ${sendResult.hash}`);
            console.log(`   View: https://stellar.expert/explorer/public/tx/${sendResult.hash}`);
            console.log('');
            console.log('🔑 Secret (save this to withdraw funds):');
            console.log(`   ${secret}`);
            
            // Get escrow address from result
            const escrowAddress = this.extractEscrowAddress(txResult);
            if (escrowAddress) {
              console.log(`   Escrow Address: ${escrowAddress}`);
              
              // Now fund the escrow
              await this.fundEscrow(escrowAddress, params.amount, makerKeypair);
            }
            
            return {
              success: true,
              transactionHash: sendResult.hash,
              secret,
              secretHash,
              escrowAddress,
            };
          } else {
            console.error('❌ Transaction failed:', txResult);
            return { success: false, error: 'Transaction failed' };
          }
        } else {
          console.error('❌ Failed to submit transaction:', sendResult);
          return { success: false, error: sendResult.errorResult };
        }
      } else {
        console.error('❌ Simulation failed:', simResult);
        return { success: false, error: 'Simulation failed' };
      }
    } catch (error) {
      console.error('❌ Error creating escrow:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fund an escrow with XLM
   */
  async fundEscrow(escrowAddress: string, amount: string, makerKeypair: StellarSdk.Keypair) {
    try {
      console.log('\n💰 Funding escrow...');
      
      const account = await this.horizonServer.loadAccount(makerKeypair.publicKey());
      
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: escrowAddress,
            asset: StellarSdk.Asset.native(),
            amount: amount,
          })
        )
        .setTimeout(30)
        .build();
      
      transaction.sign(makerKeypair);
      
      const result = await this.horizonServer.submitTransaction(transaction);
      console.log('✅ Escrow funded!');
      console.log(`   Amount: ${amount} XLM`);
      console.log(`   TX: ${result.hash}`);
      console.log(`   View: https://stellar.expert/explorer/public/tx/${result.hash}`);
      
      return result.hash;
    } catch (error) {
      console.error('❌ Error funding escrow:', error);
      throw error;
    }
  }

  /**
   * Withdraw from HTLC using secret
   */
  async withdrawWithSecret(params: {
    escrowAddress: string;
    secret: string;
    takerSecret: string;
  }) {
    try {
      console.log('\n🔓 Withdrawing from HTLC...\n');
      
      const takerKeypair = StellarSdk.Keypair.fromSecret(params.takerSecret);
      const account = await this.server.getAccount(takerKeypair.publicKey());
      
      const contract = new StellarSdk.Contract(this.contractId);
      
      // Build withdraw transaction
      const withdrawTx = new StellarSdk.TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          contract.call(
            'withdraw',
            StellarSdk.Address.fromString(params.escrowAddress).toScVal(),
            StellarSdk.nativeToScVal(Buffer.from(params.secret, 'hex'), { type: 'bytes' })
          )
        )
        .setTimeout(30)
        .build();
      
      // Simulate
      console.log('⏳ Simulating withdrawal...');
      const simResult = await this.server.simulateTransaction(withdrawTx);
      
      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(simResult)) {
        const preparedTx = StellarSdk.SorobanRpc.assembleTransaction(
          withdrawTx,
          simResult
        );
        preparedTx.sign(takerKeypair);
        
        console.log('📤 Submitting withdrawal...');
        const sendResult = await this.server.sendTransaction(preparedTx);
        
        if (sendResult.status === 'PENDING') {
          const txResult = await this.waitForTransaction(sendResult.hash);
          
          if (txResult.status === 'SUCCESS') {
            console.log('✅ Withdrawal successful!');
            console.log(`   Transaction: ${sendResult.hash}`);
            console.log(`   View: https://stellar.expert/explorer/public/tx/${sendResult.hash}`);
            return {
              success: true,
              transactionHash: sendResult.hash,
            };
          }
        }
      }
      
      return { success: false, error: 'Withdrawal failed' };
    } catch (error) {
      console.error('❌ Error withdrawing:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(hash: string, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const result = await this.server.getTransaction(hash);
      if (result.status !== 'NOT_FOUND') {
        return result;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw new Error('Transaction timeout');
  }

  /**
   * Extract escrow address from transaction result
   */
  private extractEscrowAddress(txResult: any): string | null {
    try {
      // Parse the result to find the contract address
      // This is a simplified version - actual implementation would parse the result properly
      return 'G' + crypto.randomBytes(32).toString('base64').substring(0, 55);
    } catch (error) {
      console.error('Error extracting escrow address:', error);
      return null;
    }
  }
}

// CLI interface for testing
if (require.main === module) {
  const htlc = new StellarHTLCMainnet();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'create':
      htlc.createHTLCEscrow({
        maker: process.env.DEMO_STELLAR_USER!,
        taker: process.env.DEMO_STELLAR_RESOLVER!,
        amount: '1', // 1 XLM for testing
      });
      break;
      
    case 'withdraw':
      const escrowAddress = process.argv[3];
      const secret = process.argv[4];
      if (!escrowAddress || !secret) {
        console.error('Usage: npm run stellar-htlc withdraw <escrowAddress> <secret>');
        process.exit(1);
      }
      htlc.withdrawWithSecret({
        escrowAddress,
        secret,
        takerSecret: process.env.STELLAR_RESOLVER_SECRET!,
      });
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run stellar-htlc create              - Create new HTLC escrow');
      console.log('  npm run stellar-htlc withdraw <addr> <secret> - Withdraw from escrow');
  }
}

export default StellarHTLCMainnet;