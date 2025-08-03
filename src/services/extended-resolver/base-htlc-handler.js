"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseHTLCHandler = void 0;
const ethers_1 = require("ethers");
const logger_1 = require("../resolver/utils/logger");
const crypto_1 = __importDefault(require("crypto"));
// BaseEscrow ABI
const BASE_ESCROW_ABI = [
    "function initialize(address _token, uint256 _amount, bytes32 _hashlock, uint256 _timelock, address _maker, address _taker) external",
    "function deposit() external payable",
    "function withdraw(bytes32 _secret) external",
    "function refund() external",
    "function getDetails() external view returns (address token, uint256 amount, bytes32 hashlock, uint256 timelock, address maker, address taker, bool withdrawn, bool refunded, bytes32 secret)",
    "event Deposited(address indexed sender, uint256 amount)",
    "event Withdrawn(address indexed receiver, bytes32 secret)",
    "event Refunded(address indexed sender)"
];
const ESCROW_FACTORY_ABI = [
    "function createEscrow(address token, uint256 amount, bytes32 hashlock, uint256 timelock, address maker, address taker) external returns (address)",
    "function getEscrowAddress(address token, uint256 amount, bytes32 hashlock, uint256 timelock, address maker, address taker) external view returns (address)",
    "function escrows(address) external view returns (bool)"
];
const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)"
];
class BaseHTLCHandler {
    constructor() {
        // Initialize with Base mainnet
        const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        // Use resolver's private key
        const privateKey = process.env.RESOLVER_PRIVATE_KEY;
        if (!privateKey) {
            throw new Error('RESOLVER_PRIVATE_KEY not set in environment');
        }
        // Ensure private key has 0x prefix
        const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        this.wallet = new ethers_1.ethers.Wallet(formattedKey, this.provider);
        // Initialize escrow factory
        this.factoryAddress = process.env.BASE_ESCROW_FACTORY || '0xe7e9E1B7D4BE66D596D8f599c892ffdfFD8dD866';
        this.escrowFactory = new ethers_1.ethers.Contract(this.factoryAddress, ESCROW_FACTORY_ABI, this.wallet);
        logger_1.logger.info('Base HTLC Handler initialized', {
            wallet: this.wallet.address,
            factory: this.factoryAddress,
            network: 'base-mainnet'
        });
    }
    /**
     * Create an escrow on Base for the source side of a cross-chain swap
     */
    async createSourceEscrow(params) {
        try {
            logger_1.logger.info('Creating Base escrow', params);
            // Calculate escrow address
            const escrowAddress = await this.escrowFactory.getEscrowAddress(params.token, params.amount, params.secretHash, params.timelock, params.maker, params.taker);
            logger_1.logger.info('Calculated escrow address', { escrowAddress });
            // Check if escrow already exists
            const isDeployed = await this.escrowFactory.escrows(escrowAddress);
            if (!isDeployed) {
                // Deploy escrow contract
                logger_1.logger.info('Deploying new escrow contract...');
                const tx = await this.escrowFactory.createEscrow(params.token, params.amount, params.secretHash, params.timelock, params.maker, params.taker);
                logger_1.logger.info('Escrow deployment tx sent', { hash: tx.hash });
                const receipt = await tx.wait();
                logger_1.logger.info('Escrow deployed', {
                    address: escrowAddress,
                    txHash: receipt.hash,
                    gasUsed: receipt.gasUsed.toString()
                });
            }
            else {
                logger_1.logger.info('Escrow already deployed', { escrowAddress });
            }
            return {
                success: true,
                escrowAddress,
                explorerUrl: `https://basescan.org/address/${escrowAddress}`
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to create Base escrow', { error: error instanceof Error ? error.message : String(error) });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Fund an escrow with USDC (called by the user/maker)
     */
    async fundEscrow(params) {
        try {
            logger_1.logger.info('Funding Base escrow', params);
            // Approve USDC transfer
            const usdc = new ethers_1.ethers.Contract(params.token, ERC20_ABI, this.wallet);
            const approveTx = await usdc.approve(params.escrowAddress, params.amount);
            await approveTx.wait();
            logger_1.logger.info('USDC approved for escrow');
            // Call deposit on escrow
            const escrow = new ethers_1.ethers.Contract(params.escrowAddress, BASE_ESCROW_ABI, this.wallet);
            const depositTx = await escrow.deposit();
            const receipt = await depositTx.wait();
            logger_1.logger.info('Escrow funded', {
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });
            return {
                success: true,
                txHash: receipt.hash,
                explorerUrl: `https://basescan.org/tx/${receipt.hash}`
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to fund escrow', { error: error instanceof Error ? error.message : String(error) });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Withdraw from escrow using the secret (called by resolver)
     */
    async withdrawFromEscrow(params) {
        try {
            logger_1.logger.info('Withdrawing from Base escrow', {
                escrowAddress: params.escrowAddress,
                secretHash: crypto_1.default.createHash('sha256').update(Buffer.from(params.secret, 'hex')).digest('hex')
            });
            const escrow = new ethers_1.ethers.Contract(params.escrowAddress, BASE_ESCROW_ABI, this.wallet);
            const tx = await escrow.withdraw('0x' + params.secret);
            const receipt = await tx.wait();
            logger_1.logger.info('Withdrawal successful', {
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });
            return {
                success: true,
                txHash: receipt.hash,
                explorerUrl: `https://basescan.org/tx/${receipt.hash}`
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to withdraw from escrow', { error: error instanceof Error ? error.message : String(error) });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Monitor escrow for deposits
     */
    async monitorEscrowDeposit(escrowAddress) {
        try {
            const escrow = new ethers_1.ethers.Contract(escrowAddress, BASE_ESCROW_ABI, this.provider);
            return new Promise((resolve) => {
                const filter = escrow.filters.Deposited();
                const timeout = setTimeout(() => {
                    this.provider.off(filter);
                    resolve(false);
                }, 300000); // 5 minute timeout
                this.provider.on(filter, (event) => {
                    logger_1.logger.info('Escrow deposit detected', { escrowAddress });
                    clearTimeout(timeout);
                    this.provider.off(filter);
                    resolve(true);
                });
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to monitor escrow', { error: error instanceof Error ? error.message : String(error) });
            return false;
        }
    }
}
exports.BaseHTLCHandler = BaseHTLCHandler;
