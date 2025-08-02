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
exports.MainnetHTLCHandler = void 0;
const stellar_htlc_mainnet_1 = require("../../../scripts/stellar-htlc-mainnet");
const base_htlc_handler_1 = require("./base-htlc-handler");
const contract_deployer_1 = require("../stellar/contract-deployer");
const factory_service_1 = require("../stellar/factory-service");
const stellar_contracts_1 = require("../../config/stellar-contracts");
const logger_1 = require("../resolver/utils/logger");
const crypto = __importStar(require("crypto"));
const StellarSdk = __importStar(require("stellar-sdk"));
class MainnetHTLCHandler {
    constructor() {
        this.stellarHTLC = new stellar_htlc_mainnet_1.StellarHTLCMainnet();
        this.baseHTLC = new base_htlc_handler_1.BaseHTLCHandler();
        this.contractDeployer = new contract_deployer_1.StellarContractDeployer();
        this.activeOrders = new Map();
        // Initialize deployer keypair if available
        const deployerSecret = process.env.STELLAR_DEPLOYER_SECRET || process.env.STELLAR_TEST_WALLET_SECRET;
        if (deployerSecret) {
            try {
                this.deployerKeypair = StellarSdk.Keypair.fromSecret(deployerSecret);
                logger_1.logger.info('Stellar deployer initialized', {
                    publicKey: this.deployerKeypair.publicKey()
                });
            }
            catch (error) {
                logger_1.logger.error('Failed to initialize Stellar deployer', { error: error instanceof Error ? error.message : String(error) });
            }
        }
        // Initialize factory service if configured
        const network = process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
        if ((0, stellar_contracts_1.isFactoryConfigured)(network)) {
            try {
                this.factoryService = new factory_service_1.StellarFactoryService(network);
                logger_1.logger.info('Stellar factory service initialized', {
                    network,
                    factoryId: this.factoryService.getFactoryId()
                });
            }
            catch (error) {
                logger_1.logger.warn('Factory service not available', { error: error instanceof Error ? error.message : String(error) });
            }
        }
        else {
            logger_1.logger.warn('Factory contract not configured for network', { network });
        }
    }
    /**
     * Handle a new cross-chain order that involves Stellar mainnet
     */
    async handleCrossChainOrder(order) {
        try {
            logger_1.logger.info('Processing mainnet HTLC order', { orderId: order.orderId });
            // Generate secret for this order
            const secret = crypto.randomBytes(32).toString('hex');
            const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
            // Store order details
            this.activeOrders.set(order.orderId, {
                ...order,
                secret,
                secretHash,
                status: 'creating_escrow',
                created: new Date().toISOString(),
            });
            // Step 1: Create escrow on Base (source chain)
            logger_1.logger.info('Creating Base escrow for source funds');
            // Get USDC address on Base
            const baseUSDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
            const baseEscrowResult = await this.baseHTLC.createSourceEscrow({
                token: baseUSDC,
                amount: order.amount,
                secretHash,
                timelock: Math.floor(Date.now() / 1000) + 7200, // 2 hours
                maker: order.maker, // User who deposits USDC
                taker: process.env.RESOLVER_ADDRESS, // Resolver who will claim
            });
            if (!baseEscrowResult.success) {
                throw new Error(`Failed to create Base escrow: ${baseEscrowResult.error}`);
            }
            // Update order with Base escrow info
            this.activeOrders.set(order.orderId, {
                ...this.activeOrders.get(order.orderId),
                baseEscrow: {
                    address: baseEscrowResult.escrowAddress,
                    explorerUrl: baseEscrowResult.explorerUrl,
                },
            });
            // Step 2: Deploy and initialize new HTLC contract on Stellar mainnet
            logger_1.logger.info('Creating Stellar HTLC for destination funds');
            // In cross-chain swaps:
            // - Stellar "maker" is the user who will receive funds (stellarReceiver)
            // - Stellar "taker" is the resolver who provides liquidity
            const stellarMaker = order.stellarReceiver || process.env.DEMO_STELLAR_USER;
            const stellarTaker = process.env.DEMO_STELLAR_RESOLVER;
            logger_1.logger.info('Using Stellar addresses:', {
                maker: stellarMaker,
                taker: stellarTaker,
            });
            // Convert amount from stroops to XLM
            const amountInStroops = parseFloat(order.amount);
            const amountInXLM = (amountInStroops / 10000000).toFixed(7);
            let escrowResult;
            // Use factory service if available
            if (this.factoryService && this.deployerKeypair) {
                logger_1.logger.info('Using factory to deploy new HTLC escrow...');
                try {
                    // Calculate timelocks (packed into u64)
                    const currentTime = Math.floor(Date.now() / 1000);
                    const timelocks = this.packTimelocks({
                        srcWithdrawal: currentTime + 3600, // 1 hour
                        srcPublicWithdrawal: currentTime + 7200, // 2 hours
                        srcCancellation: currentTime + 10800, // 3 hours
                        srcPublicCancellation: currentTime + 14400, // 4 hours
                        dstWithdrawal: currentTime + 1800, // 30 minutes
                        dstPublicWithdrawal: currentTime + 3600, // 1 hour
                        dstCancellation: currentTime + 5400, // 1.5 hours
                        dstPublicCancellation: currentTime + 7200, // 2 hours
                    });
                    // Get token address (native XLM for now)
                    const stellarContracts = (0, stellar_contracts_1.getStellarContracts)(process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet');
                    const tokenAddress = stellarContracts.nativeToken;
                    // Create escrow parameters
                    const escrowParams = {
                        orderHash: crypto.randomBytes(32).toString('hex'), // Generate unique order hash
                        hashlock: secretHash,
                        maker: stellarMaker,
                        taker: stellarTaker,
                        token: tokenAddress,
                        amount: amountInStroops.toString(),
                        safetyDeposit: '0', // No safety deposit for now
                        timelocks: timelocks.toString(),
                    };
                    // First calculate the escrow address
                    const escrowAddress = await this.factoryService.calculateEscrowAddress(escrowParams);
                    logger_1.logger.info('Calculated escrow address', { escrowAddress });
                    // Deploy the escrow
                    const deployedAddress = await this.factoryService.deployEscrow({
                        ...escrowParams,
                        sourceKeypair: this.deployerKeypair,
                    });
                    if (deployedAddress !== escrowAddress) {
                        logger_1.logger.warn('Deployed address differs from calculated', {
                            calculated: escrowAddress,
                            deployed: deployedAddress,
                        });
                    }
                    escrowResult = {
                        success: true,
                        transactionHash: 'factory-deploy-' + Date.now(), // Factory returns address, not tx hash
                        escrowAddress: deployedAddress,
                        secret,
                        secretHash,
                    };
                }
                catch (error) {
                    logger_1.logger.error('Factory deployment failed, falling back to demo mode', { error: error instanceof Error ? error.message : String(error) });
                    // Fall back to demo mode
                    escrowResult = await this.stellarHTLC.createHTLCEscrow({
                        maker: stellarMaker,
                        taker: stellarTaker,
                        amount: amountInXLM,
                        secret,
                        timelockSeconds: 3600,
                    });
                }
            }
            else {
                // Fallback to the demo approach
                logger_1.logger.info('Using demo HTLC (factory not available)');
                escrowResult = await this.stellarHTLC.createHTLCEscrow({
                    maker: stellarMaker,
                    taker: stellarTaker,
                    amount: amountInXLM,
                    secret,
                    timelockSeconds: 3600,
                });
            }
            if (escrowResult.success) {
                // Update order status
                const orderData = this.activeOrders.get(order.orderId);
                orderData.status = 'escrow_created';
                orderData.escrowAddress = escrowResult.escrowAddress;
                orderData.stellarTxHash = escrowResult.transactionHash;
                orderData.explorerUrl = `https://stellar.expert/explorer/public/tx/${escrowResult.transactionHash}`;
                logger_1.logger.info('Mainnet HTLC escrow created', {
                    orderId: order.orderId,
                    txHash: escrowResult.transactionHash,
                    escrowAddress: escrowResult.escrowAddress,
                });
                return {
                    success: true,
                    orderId: order.orderId,
                    secret: escrowResult.secret,
                    secretHash: escrowResult.secretHash,
                    base: {
                        escrowAddress: baseEscrowResult.escrowAddress,
                        explorerUrl: baseEscrowResult.explorerUrl,
                    },
                    stellar: {
                        escrowAddress: escrowResult.escrowAddress,
                        transactionHash: escrowResult.transactionHash,
                        explorerUrl: `https://stellar.expert/explorer/public/tx/${escrowResult.transactionHash}`,
                    },
                    escrowAddresses: {
                        base: baseEscrowResult.escrowAddress,
                        stellar: escrowResult.escrowAddress,
                    },
                };
            }
            else {
                logger_1.logger.error('Failed to create mainnet HTLC escrow', {
                    orderId: order.orderId,
                    error: escrowResult.error,
                });
                const orderData = this.activeOrders.get(order.orderId);
                orderData.status = 'failed';
                orderData.error = escrowResult.error;
                return {
                    success: false,
                    error: escrowResult.error,
                };
            }
        }
        catch (error) {
            logger_1.logger.error('Error handling mainnet HTLC order', {
                orderId: order.orderId,
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    /**
     * Check if we should use real mainnet transactions
     */
    shouldUseMainnet() {
        return process.env.STELLAR_NETWORK === 'mainnet';
    }
    /**
     * Get order status
     */
    getOrderStatus(orderId) {
        const order = this.activeOrders.get(orderId);
        if (!order) {
            return null;
        }
        return {
            orderId: order.orderId,
            status: order.status,
            created: order.created,
            error: order.error,
            ethereum: order.ethereumHTLC,
            stellar: {
                escrowAddress: order.escrowAddress,
                transactionHash: order.stellarTxHash,
                explorerUrl: order.explorerUrl,
            },
        };
    }
    /**
     * Convert amount to XLM based on token type
     */
    convertToXLM(amount, token) {
        // For demo purposes, we'll use small amounts
        // In production, this would use real exchange rates
        switch (token) {
            case 'USDC':
                // Assuming 1 USDC = 10 XLM for demo
                return (parseFloat(amount) * 10).toFixed(2);
            case 'ETH':
                // Assuming 1 ETH = 20000 XLM for demo
                return (parseFloat(amount) * 20000).toFixed(2);
            case 'XLM':
            default:
                return amount;
        }
    }
    /**
     * Reveal secret for an order (after user claims on destination chain)
     */
    async revealSecret(orderId) {
        const order = this.activeOrders.get(orderId);
        if (!order || !order.secret) {
            return null;
        }
        // In production, this would only reveal after confirming the destination chain claim
        order.status = 'secret_revealed';
        order.revealedAt = new Date().toISOString();
        logger_1.logger.info('Secret revealed for order', { orderId });
        return order.secret;
    }
    /**
     * Pack timelocks into a single u64 value
     * Each timelock is 8 bits (0-255 hours from base time)
     */
    packTimelocks(timelocks) {
        const baseTime = Math.floor(Date.now() / 1000);
        // Convert absolute timestamps to hours from base time
        const toHours = (timestamp) => Math.min(255, Math.floor((timestamp - baseTime) / 3600));
        // Pack into u64 (8 bytes, each timelock gets 1 byte)
        return BigInt(toHours(timelocks.srcWithdrawal)) |
            (BigInt(toHours(timelocks.srcPublicWithdrawal)) << BigInt(8)) |
            (BigInt(toHours(timelocks.srcCancellation)) << BigInt(16)) |
            (BigInt(toHours(timelocks.srcPublicCancellation)) << BigInt(24)) |
            (BigInt(toHours(timelocks.dstWithdrawal)) << BigInt(32)) |
            (BigInt(toHours(timelocks.dstPublicWithdrawal)) << BigInt(40)) |
            (BigInt(toHours(timelocks.dstCancellation)) << BigInt(48)) |
            (BigInt(toHours(timelocks.dstPublicCancellation)) << BigInt(56));
    }
}
exports.MainnetHTLCHandler = MainnetHTLCHandler;
