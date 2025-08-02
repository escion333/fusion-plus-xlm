import * as StellarSdk from 'stellar-sdk';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../resolver/utils/logger';

export interface DeploymentResult {
  success: boolean;
  contractId?: string;
  wasmHash?: string;
  transactionHash?: string;
  error?: string;
}

export class StellarContractDeployer {
  private server: StellarSdk.rpc.Server;
  private horizonServer: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private wasmPath: string;
  private wasmHash?: string;
  
  constructor(
    sorobanRpc: string = 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    network: 'PUBLIC' | 'TESTNET' = 'PUBLIC'
  ) {
    this.server = new StellarSdk.rpc.Server(sorobanRpc);
    this.horizonServer = new StellarSdk.Horizon.Server(
      network === 'PUBLIC' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org'
    );
    this.networkPassphrase = network === 'PUBLIC' 
      ? StellarSdk.Networks.PUBLIC 
      : StellarSdk.Networks.TESTNET;
    this.wasmPath = path.join(__dirname, '../../../stellar-fusion/target/wasm32-unknown-unknown/release/stellar_escrow.wasm');
  }

  /**
   * Upload WASM code once (can be reused for multiple deployments)
   */
  async uploadWasm(deployerKeypair: StellarSdk.Keypair): Promise<string | null> {
    try {
      // If we already have the WASM hash, return it
      if (this.wasmHash) {
        return this.wasmHash;
      }

      logger.info('Uploading HTLC contract WASM...');
      
      // Check if WASM file exists
      if (!fs.existsSync(this.wasmPath)) {
        throw new Error(`WASM file not found at ${this.wasmPath}`);
      }
      
      // Read contract WASM
      const contractWasm = fs.readFileSync(this.wasmPath);
      logger.info(`WASM size: ${contractWasm.length} bytes`);
      
      // Get source account from Horizon
      const sourceAccount = await this.horizonServer.loadAccount(deployerKeypair.publicKey());
      
      // Create upload transaction
      const uploadTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: '1000000', // 0.1 XLM for upload
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.uploadContractWasm({
            wasm: contractWasm,
          })
        )
        .setTimeout(180)
        .build();
      
      // Simulate
      const simResult = await this.server.simulateTransaction(uploadTx);
      
      if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        logger.error('WASM upload simulation failed', { error: simResult });
        return null;
      }
      
      // Prepare and sign
      const assembledTxBuilder = StellarSdk.rpc.assembleTransaction(uploadTx, simResult);
      const preparedTx = assembledTxBuilder.build();
      preparedTx.sign(deployerKeypair);
      
      // Submit
      logger.info('Submitting WASM upload transaction...');
      const sendResult = await this.server.sendTransaction(preparedTx);
      
      if (sendResult.status === 'PENDING') {
        // Wait for confirmation
        const txResult = await this.waitForTransaction(sendResult.hash);
        
        if (txResult && txResult.status === 'SUCCESS') {
          // The WASM hash is the SHA256 hash of the uploaded bytecode
          const contractWasm = fs.readFileSync(this.wasmPath);
          this.wasmHash = crypto.createHash('sha256').update(contractWasm).digest('hex');
          
          logger.info('WASM uploaded successfully', { 
            wasmHash: this.wasmHash,
            txHash: sendResult.hash 
          });
          return this.wasmHash;
        }
      }
      
      logger.error('Failed to upload WASM', { result: sendResult });
      return null;
      
    } catch (error) {
      logger.error('Error uploading WASM', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  /**
   * Deploy a new contract instance
   */
  async deployContract(deployerKeypair: StellarSdk.Keypair): Promise<DeploymentResult> {
    try {
      // First ensure WASM is uploaded
      const wasmHash = await this.uploadWasm(deployerKeypair);
      if (!wasmHash) {
        return { success: false, error: 'Failed to upload WASM' };
      }
      
      logger.info('Deploying new HTLC contract instance...');
      
      // Wait a bit for WASM to be fully available on the network
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get source account from Horizon
      const sourceAccount = await this.horizonServer.loadAccount(deployerKeypair.publicKey());
      
      // Generate random salt
      const salt = crypto.randomBytes(32);
      
      // Create deployment transaction
      const deployTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: '100000', // 0.01 XLM
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          StellarSdk.Operation.createCustomContract({
            wasmHash: Buffer.from(wasmHash, 'hex'),
            address: StellarSdk.Address.fromString(deployerKeypair.publicKey()),
            salt,
          })
        )
        .setTimeout(180)
        .build();
      
      // Simulate
      const simResult = await this.server.simulateTransaction(deployTx);
      
      if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        logger.error('Contract deployment simulation failed', { error: simResult });
        return { success: false, error: 'Deployment simulation failed' };
      }
      
      // Contract ID will be extracted from the transaction result after submission
      
      // Prepare and sign
      const assembledTxBuilder = StellarSdk.rpc.assembleTransaction(deployTx, simResult);
      const preparedTx = assembledTxBuilder.build();
      preparedTx.sign(deployerKeypair);
      
      // Submit
      logger.info('Submitting contract deployment transaction...');
      const sendResult = await this.server.sendTransaction(preparedTx);
      
      if (sendResult.status === 'PENDING') {
        // Wait for confirmation
        const txResult = await this.waitForTransaction(sendResult.hash);
        
        if (txResult && txResult.status === 'SUCCESS') {
          // Extract contract ID from transaction result
          const contractId = this.extractContractIdFromResult(txResult);
          
          if (!contractId) {
            logger.error('Failed to extract contract ID from result');
            return { success: false, error: 'Could not extract contract ID' };
          }
          
          logger.info('Contract deployed successfully', { 
            contractId,
            txHash: sendResult.hash 
          });
          
          return {
            success: true,
            contractId,
            wasmHash,
            transactionHash: sendResult.hash,
          };
        }
      }
      
      logger.error('Failed to deploy contract', { result: sendResult });
      return { success: false, error: 'Contract deployment failed' };
      
    } catch (error) {
      logger.error('Error deploying contract', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Initialize HTLC on a newly deployed contract
   */
  async initializeHTLC(
    contractId: string,
    deployerKeypair: StellarSdk.Keypair,
    params: {
      maker: string;
      taker: string;
      amount: string; // in XLM
      secretHash: string;
      timelockSeconds: number;
    }
  ): Promise<{ success: boolean; transactionHash?: string; error?: string }> {
    try {
      logger.info('Initializing HTLC escrow...', { contractId });
      
      // Get source account from Horizon
      const sourceAccount = await this.horizonServer.loadAccount(deployerKeypair.publicKey());
      
      // Create contract instance
      const contract = new StellarSdk.Contract(contractId);
      
      // Build initialization transaction
      const initTx = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: '100000',
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          contract.call(
            'deploy_escrow',
            StellarSdk.Address.fromString(params.maker).toScVal(),
            StellarSdk.Address.fromString(params.taker).toScVal(),
            StellarSdk.Address.fromString('CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAUHKENYN33').toScVal(), // Native XLM
            StellarSdk.nativeToScVal(Math.floor(parseFloat(params.amount) * 10000000), { type: 'i128' }),
            StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.secretHash, 'hex')),
            StellarSdk.nativeToScVal(params.timelockSeconds, { type: 'u64' }),
            StellarSdk.nativeToScVal(0, { type: 'i128' }), // No safety deposit
          )
        )
        .setTimeout(30)
        .build();
      
      // Simulate
      const simResult = await this.server.simulateTransaction(initTx);
      
      if (!StellarSdk.rpc.Api.isSimulationSuccess(simResult)) {
        logger.error('HTLC initialization simulation failed', { error: simResult });
        return { success: false, error: 'Initialization simulation failed' };
      }
      
      // Prepare and sign
      const assembledTxBuilder = StellarSdk.rpc.assembleTransaction(initTx, simResult);
      const preparedTx = assembledTxBuilder.build();
      preparedTx.sign(deployerKeypair);
      
      // Submit
      logger.info('Submitting HTLC initialization transaction...');
      const sendResult = await this.server.sendTransaction(preparedTx);
      
      if (sendResult.status === 'PENDING') {
        // Wait for confirmation
        const txResult = await this.waitForTransaction(sendResult.hash);
        
        if (txResult && txResult.status === 'SUCCESS') {
          logger.info('HTLC initialized successfully', { 
            contractId,
            txHash: sendResult.hash 
          });
          
          return {
            success: true,
            transactionHash: sendResult.hash,
          };
        }
      }
      
      logger.error('Failed to initialize HTLC', { result: sendResult });
      return { success: false, error: 'HTLC initialization failed' };
      
    } catch (error) {
      logger.error('Error initializing HTLC', { error: error instanceof Error ? error.message : String(error) });
      return { success: false, error: error instanceof Error ? error.message : String(error) };
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
        // Transaction not found yet, continue polling
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
  }

  // Removed - no longer needed since we calculate hash from bytecode

  private extractContractIdFromSim(simResult: any): string | null {
    try {
      // Extract contract ID from simulation result
      // For createCustomContract, the contract address is deterministic based on deployer and salt
      // We'll get it from the transaction result after submission
      
      // Return a placeholder that will be replaced after transaction submission
      return 'pending';
    } catch (error) {
      logger.error('Error extracting contract ID', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
  
  private extractContractIdFromResult(txResult: any): string | null {
    try {
      // Try to parse the result meta XDR
      if (!txResult.resultMetaXdr) {
        logger.error('No resultMetaXdr in transaction result');
        return null;
      }
      
      const meta = txResult.resultMetaXdr;
      const metaXdr = StellarSdk.xdr.TransactionMeta.fromXDR(meta, 'base64');
      
      // For V3 meta, look in sorobanMeta
      if (metaXdr.switch() === 3) {
        const v3 = metaXdr.v3();
        if (v3 && v3.sorobanMeta()) {
          const sorobanMeta = v3.sorobanMeta();
          if (!sorobanMeta) return null;
          const returnValue = sorobanMeta.returnValue();
          
          if (returnValue) {
            // Check if it's an address type
            if (returnValue.switch().name === 'scvAddress' || returnValue.switch() === StellarSdk.xdr.ScValType.scvAddress()) {
              const address = returnValue.address();
              // Check if it's a contract address
              if (address.switch().name === 'scAddressTypeContract' || address.switch() === StellarSdk.xdr.ScAddressType.scAddressTypeContract()) {
                const contractIdBuffer = address.contractId();
                const contractId = StellarSdk.StrKey.encodeContract(contractIdBuffer);
                logger.info('Extracted contract ID from result', { contractId });
                return contractId;
              }
            }
          }
        }
      }
      
      logger.error('Could not find contract ID in expected location');
      return null;
    } catch (error) {
      logger.error('Error extracting contract ID from result', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        resultMetaXdr: txResult.resultMetaXdr ? 'present' : 'missing'
      });
      return null;
    }
  }
}