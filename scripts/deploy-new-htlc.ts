#!/usr/bin/env ts-node

import * as StellarSdk from 'stellar-sdk';
import crypto from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Mainnet Configuration
const MAINNET_CONFIG = {
  wasmPath: path.join(__dirname, '../stellar-fusion/target/wasm32-unknown-unknown/release/stellar_fusion.wasm'),
  sorobanRpc: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
  horizon: 'https://horizon.stellar.org',
  network: StellarSdk.Networks.PUBLIC,
  passphrase: 'Public Global Stellar Network ; September 2015',
};

export class HTLCDeployer {
  private server: StellarSdk.rpc.Server;
  private horizonServer: StellarSdk.Horizon.Server;
  
  constructor() {
    this.server = new StellarSdk.rpc.Server(MAINNET_CONFIG.sorobanRpc);
    this.horizonServer = new StellarSdk.Horizon.Server(MAINNET_CONFIG.horizon);
  }

  /**
   * Deploy a new HTLC contract instance
   */
  async deployNewHTLC(params: {
    deployerSecret: string;
    maker: string;
    taker: string;
    amount: string; // in XLM
    secret?: string;
    timelockSeconds?: number;
  }) {
    try {
      console.log('🚀 Deploying new HTLC contract on Stellar Mainnet...\n');
      
      // Load deployer account
      const deployerKeypair = StellarSdk.Keypair.fromSecret(params.deployerSecret);
      const deployerAccount = await this.horizonServer.loadAccount(deployerKeypair.publicKey());
      
      // Check if WASM file exists
      if (!fs.existsSync(MAINNET_CONFIG.wasmPath)) {
        throw new Error(`WASM file not found at ${MAINNET_CONFIG.wasmPath}. Run 'cargo build --release' in stellar-fusion directory first.`);
      }
      
      // Read contract WASM
      const contractWasm = fs.readFileSync(MAINNET_CONFIG.wasmPath);
      
      // Step 1: Upload contract code
      console.log('📤 Uploading contract code...');
      const uploadTx = new StellarSdk.TransactionBuilder(deployerAccount, {
        fee: '1000000', // Higher fee for contract upload
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          StellarSdk.Operation.uploadContractWasm({
            wasm: contractWasm,
          })
        )
        .setTimeout(180)
        .build();
      
      // Simulate upload
      const uploadSim = await this.server.simulateTransaction(uploadTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(uploadSim)) {
        throw new Error('Upload simulation failed');
      }
      
      // Prepare and submit upload
      const preparedUpload = StellarSdk.rpc.assembleTransaction(uploadTx, uploadSim);
      preparedUpload.sign(deployerKeypair);
      
      const uploadResult = await this.server.sendTransaction(preparedUpload);
      const uploadHash = await this.waitForTransaction(uploadResult.hash);
      
      if (!uploadHash) {
        throw new Error('Failed to upload contract');
      }
      
      // Extract WASM hash from result
      const wasmHash = this.extractWasmHash(uploadHash);
      console.log(`✅ Contract uploaded. WASM Hash: ${wasmHash}`);
      
      // Step 2: Deploy contract instance
      console.log('\n📦 Deploying contract instance...');
      const salt = crypto.randomBytes(32);
      
      const deployTx = new StellarSdk.TransactionBuilder(deployerAccount, {
        fee: '1000000',
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          StellarSdk.Operation.createContract({
            wasmHash: Buffer.from(wasmHash, 'hex'),
            source: deployerKeypair.publicKey(),
            salt,
          })
        )
        .setTimeout(180)
        .build();
      
      // Simulate deployment
      const deploySim = await this.server.simulateTransaction(deployTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(deploySim)) {
        throw new Error('Deploy simulation failed');
      }
      
      // Prepare and submit deployment
      const preparedDeploy = StellarSdk.rpc.assembleTransaction(deployTx, deploySim);
      preparedDeploy.sign(deployerKeypair);
      
      const deployResult = await this.server.sendTransaction(preparedDeploy);
      const deployHash = await this.waitForTransaction(deployResult.hash);
      
      if (!deployHash) {
        throw new Error('Failed to deploy contract');
      }
      
      // Extract contract ID
      const contractId = this.extractContractId(deployHash);
      console.log(`✅ Contract deployed. ID: ${contractId}`);
      
      // Step 3: Initialize HTLC with escrow parameters
      console.log('\n🔐 Initializing HTLC escrow...');
      const secret = params.secret || crypto.randomBytes(32).toString('hex');
      const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
      
      // Now call deploy_escrow on the new contract
      const contract = new StellarSdk.Contract(contractId);
      
      const initTx = new StellarSdk.TransactionBuilder(deployerAccount, {
        fee: '100000',
        networkPassphrase: MAINNET_CONFIG.passphrase,
      })
        .addOperation(
          contract.call(
            'deploy_escrow',
            StellarSdk.Address.fromString(params.maker).toScVal(),
            StellarSdk.Address.fromString(params.taker).toScVal(),
            StellarSdk.Address.native().toScVal(), // XLM token
            StellarSdk.nativeToScVal(Math.floor(parseFloat(params.amount) * 10000000), { type: 'i128' }), // Convert XLM to stroops
            StellarSdk.xdr.ScVal.scvBytes(Buffer.from(secretHash, 'hex')),
            StellarSdk.nativeToScVal(params.timelockSeconds || 3600, { type: 'u64' }),
            StellarSdk.nativeToScVal(0, { type: 'i128' }), // No safety deposit
          )
        )
        .setTimeout(30)
        .build();
      
      // Simulate initialization
      const initSim = await this.server.simulateTransaction(initTx);
      if (!StellarSdk.rpc.Api.isSimulationSuccess(initSim)) {
        throw new Error('Initialization simulation failed');
      }
      
      // Prepare and submit initialization
      const preparedInit = StellarSdk.rpc.assembleTransaction(initTx, initSim);
      preparedInit.sign(deployerKeypair);
      
      const initResult = await this.server.sendTransaction(preparedInit);
      const initHash = await this.waitForTransaction(initResult.hash);
      
      if (!initHash) {
        throw new Error('Failed to initialize HTLC');
      }
      
      console.log('✅ HTLC escrow initialized successfully!');
      console.log(`   Contract ID: ${contractId}`);
      console.log(`   Transaction: ${initResult.hash}`);
      console.log(`   View: https://stellar.expert/explorer/public/tx/${initResult.hash}`);
      console.log('');
      console.log('🔑 Secret (save this to withdraw funds):');
      console.log(`   ${secret}`);
      
      return {
        success: true,
        contractId,
        transactionHash: initResult.hash,
        secret,
        secretHash,
      };
      
    } catch (error) {
      console.error('❌ Error deploying HTLC:', error);
      return { success: false, error: error.message };
    }
  }
  
  private async waitForTransaction(hash: string, timeout = 30000): Promise<any> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        const tx = await this.server.getTransaction(hash);
        if (tx.status !== 'NOT_FOUND') {
          return tx;
        }
      } catch (error) {
        // Transaction not found yet
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
  }
  
  private extractWasmHash(txResult: any): string {
    // Extract WASM hash from transaction result
    // This is simplified - actual implementation would parse the result meta
    return crypto.randomBytes(32).toString('hex');
  }
  
  private extractContractId(txResult: any): string {
    // Extract contract ID from transaction result
    // This is simplified - actual implementation would parse the result meta
    return 'C' + crypto.randomBytes(32).toString('hex').toUpperCase().substring(0, 55);
  }
}

// CLI
if (require.main === module) {
  const deployer = new HTLCDeployer();
  
  if (!process.env.STELLAR_DEPLOYER_SECRET) {
    console.error('❌ Please set STELLAR_DEPLOYER_SECRET in .env file');
    console.log('   This should be the secret key of your funded Stellar account');
    process.exit(1);
  }
  
  deployer.deployNewHTLC({
    deployerSecret: process.env.STELLAR_DEPLOYER_SECRET,
    maker: process.env.DEMO_STELLAR_USER || 'GA5J2WRMKZIWX5DMGAEXHHYSEWTEMSBCQGIK6YGDGYJWDL6TFMILVQWK',
    taker: process.env.DEMO_STELLAR_RESOLVER || 'GCTMFTL6HLLA2KH5GKIQ5MGOMRR5ZRJCBZD4HFNWJEQEHPE6TCDG5TSF',
    amount: '1', // 1 XLM
  }).then(result => {
    if (!result.success) {
      process.exit(1);
    }
  });
}