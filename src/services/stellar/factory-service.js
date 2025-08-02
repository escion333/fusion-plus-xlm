"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StellarFactoryService = void 0;
const StellarSdk = __importStar(require("stellar-sdk"));
const stellar_sdk_1 = require("stellar-sdk");
const stellar_contracts_1 = require("../../config/stellar-contracts");
const logger_1 = require("../resolver/utils/logger");
const stellarConfirm_1 = require("../../utils/stellarConfirm");
class StellarFactoryService {
    constructor(network = 'mainnet') {
        this.network = network;
        const contracts = (0, stellar_contracts_1.getStellarContracts)(network);
        if (!contracts.factory) {
            throw new Error(`Factory contract not configured for ${network}. Please set STELLAR_FACTORY_${network.toUpperCase()} environment variable.`);
        }
        this.factoryId = contracts.factory;
        const rpcUrl = network === 'mainnet'
            ? 'https://soroban-rpc.mainnet.stellar.gateway.fm'
            : 'https://soroban-testnet.stellar.org';
        this.server = new stellar_sdk_1.rpc.Server(rpcUrl);
    }
    /**
     * Calculate the deterministic address for an escrow
     */
    async calculateEscrowAddress(params) {
        console.log('🔮 Calculating escrow address for params:', params);
        const contract = new StellarSdk.Contract(this.factoryId);
        // Build the operation
        const operation = contract.call('calculate_escrow_address', StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.orderHash, 'hex')), StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.hashlock, 'hex')), StellarSdk.Address.fromString(params.maker).toScVal(), StellarSdk.Address.fromString(params.taker).toScVal(), StellarSdk.Address.fromString(params.token).toScVal(), StellarSdk.nativeToScVal(params.amount, { type: 'i128' }), StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }), StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' }));
        // Create a dummy source account for simulation
        const sourceAccount = new StellarSdk.Account('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF', '0');
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
            if (stellar_sdk_1.rpc.Api.isSimulationSuccess(response)) {
                const result = response.result;
                if (result && result.retval) {
                    const address = StellarSdk.Address.fromScVal(result.retval);
                    console.log('✅ Calculated escrow address:', address.toString());
                    return address.toString();
                }
            }
            throw new Error('Failed to calculate escrow address: ' + JSON.stringify(response));
        }
        catch (error) {
            console.error('❌ Error calculating escrow address:', error);
            throw error;
        }
    }
    /**
     * Deploy a new escrow through the factory
     */
    async deployEscrow(params) {
        console.log('🚀 Deploying escrow with params:', {
            ...params,
            sourceKeypair: params.sourceKeypair.publicKey()
        });
        const sourceAccount = await this.server.getAccount(params.sourceKeypair.publicKey());
        const contract = new StellarSdk.Contract(this.factoryId);
        const operation = contract.call('deploy_escrow', StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.orderHash, 'hex')), StellarSdk.xdr.ScVal.scvBytes(Buffer.from(params.hashlock, 'hex')), StellarSdk.Address.fromString(params.maker).toScVal(), StellarSdk.Address.fromString(params.taker).toScVal(), StellarSdk.Address.fromString(params.token).toScVal(), StellarSdk.nativeToScVal(params.amount, { type: 'i128' }), StellarSdk.nativeToScVal(params.safetyDeposit, { type: 'i128' }), StellarSdk.nativeToScVal(params.timelocks, { type: 'u64' }));
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
                    return escrowAddress;
                }
                else {
                    throw new Error(`Transaction failed with status: ${result.status}`);
                }
            }
            throw new Error(`Transaction submission failed: ${response.status}`);
        }
        catch (error) {
            console.error('❌ Error deploying escrow:', error);
            throw error;
        }
    }
    /**
     * Wait for transaction confirmation
     */
    async waitForTransaction(hash, maxAttempts = 30) {
        try {
            for (let i = 0; i < maxAttempts; i++) {
                const response = await this.server.getTransaction(hash);
                if (response.status !== 'NOT_FOUND') {
                    return response;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            throw new Error('Transaction timeout');
        }
        catch (error) {
            if (error instanceof Error && /xdr|Bad union switch/i.test(error.message)) {
                console.warn('SDK XDR parse failed, falling back to direct RPC poll');
                await (0, stellarConfirm_1.confirmTx)(hash);
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
                };
            }
            throw error;
        }
    }
    /**
     * Parse escrow address from transaction result
     */
    async parseEscrowAddressFromResult(result) {
        // The deploy_escrow function returns the address directly
        if (result.returnValue) {
            const address = StellarSdk.Address.fromScVal(result.returnValue);
            return address.toString();
        }
        // Fallback: look for contract creation in the meta
        if (result.resultMetaXdr) {
            try {
                // XDR parsing would go here, but for now we'll use a deterministic approach
                logger_1.logger.warn('Using deterministic address generation as fallback');
            }
            catch (error) {
                logger_1.logger.error('Failed to parse XDR meta:', error);
            }
        }
        throw new Error('No escrow address found in transaction result');
    }
    /**
     * Get factory contract ID
     */
    getFactoryId() {
        return this.factoryId;
    }
    /**
     * Check if factory is available
     */
    isAvailable() {
        return !!this.factoryId;
    }
}
exports.StellarFactoryService = StellarFactoryService;
