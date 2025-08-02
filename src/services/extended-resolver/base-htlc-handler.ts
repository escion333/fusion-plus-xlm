import { ethers } from 'ethers';
import { logger } from '../resolver/utils/logger';
import crypto from 'crypto';

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
  "function deployEscrow(tuple(bytes32 orderHash, address srcToken, uint256 srcAmount, address srcReceiver, bytes32 hashlock, uint256 timelock, address maker, address taker) calldata imm) external returns (address)",
  "function predictEscrow(bytes32 orderHash) external view returns (address)",
  "function escrows(address) external view returns (bool)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
];

export class BaseHTLCHandler {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private escrowFactory: ethers.Contract;
  private factoryAddress: string;

  constructor() {
    // Initialize with Base mainnet
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // Use resolver's private key
    const privateKey = process.env.RESOLVER_PRIVATE_KEY!;
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    
    // Initialize escrow factory
    this.factoryAddress = process.env.BASE_ESCROW_FACTORY || '0xEe269949275B9b9C2c65e15922CC1F12ED82666E';
    this.escrowFactory = new ethers.Contract(this.factoryAddress, ESCROW_FACTORY_ABI, this.wallet);
    
    logger.info('Base HTLC Handler initialized', {
      wallet: this.wallet.address,
      factory: this.factoryAddress,
      network: 'base-mainnet'
    });
  }

  /**
   * Create an escrow on Base for the source side of a cross-chain swap
   */
  async createSourceEscrow(params: {
    token: string;
    amount: string;
    secretHash: string;
    timelock: number;
    maker: string; // User who deposits USDC
    taker: string; // Resolver who will claim
    orderHash?: string;
  }) {
    try {
      logger.info('Creating Base escrow', params);
      
      // Generate order hash if not provided
      const orderHash = params.orderHash || ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'uint256', 'bytes32', 'uint256', 'address', 'address'],
          [params.token, params.amount, params.secretHash, params.timelock, params.maker, params.taker]
        )
      );
      
      // Predict escrow address
      const escrowAddress = await this.escrowFactory.predictEscrow(orderHash);
      logger.info('Predicted escrow address', { escrowAddress, orderHash });
      
      // Check if escrow already exists
      const isDeployed = await this.escrowFactory.escrows(escrowAddress);
      
      if (!isDeployed) {
        // Deploy escrow contract
        logger.info('Deploying new escrow contract...');
        
        const immutables = {
          orderHash,
          srcToken: params.token,
          srcAmount: params.amount,
          srcReceiver: params.taker, // Resolver receives on Base
          hashlock: params.secretHash,
          timelock: params.timelock,
          maker: params.maker,
          taker: params.taker
        };
        
        const tx = await this.escrowFactory.deployEscrow(immutables);
        logger.info('Escrow deployment tx sent', { hash: tx.hash });
        
        const receipt = await tx.wait();
        logger.info('Escrow deployed', {
          address: escrowAddress,
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed.toString()
        });
      } else {
        logger.info('Escrow already deployed', { escrowAddress });
      }
      
      return {
        success: true,
        escrowAddress,
        orderHash,
        explorerUrl: `https://basescan.org/address/${escrowAddress}`
      };
      
    } catch (error) {
      logger.error('Failed to create Base escrow', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Fund an escrow with USDC (called by the user/maker)
   */
  async fundEscrow(params: {
    escrowAddress: string;
    token: string;
    amount: string;
  }) {
    try {
      logger.info('Funding Base escrow', params);
      
      // Approve USDC transfer
      const usdc = new ethers.Contract(params.token, ERC20_ABI, this.wallet);
      const approveTx = await usdc.approve(params.escrowAddress, params.amount);
      await approveTx.wait();
      
      logger.info('USDC approved for escrow');
      
      // Call deposit on escrow
      const escrow = new ethers.Contract(params.escrowAddress, BASE_ESCROW_ABI, this.wallet);
      const depositTx = await escrow.deposit();
      const receipt = await depositTx.wait();
      
      logger.info('Escrow funded', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      });
      
      return {
        success: true,
        txHash: receipt.hash,
        explorerUrl: `https://basescan.org/tx/${receipt.hash}`
      };
      
    } catch (error) {
      logger.error('Failed to fund escrow', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Withdraw from escrow using the secret (called by resolver)
   */
  async withdrawFromEscrow(params: {
    escrowAddress: string;
    secret: string;
  }) {
    try {
      logger.info('Withdrawing from Base escrow', {
        escrowAddress: params.escrowAddress,
        secretHash: crypto.createHash('sha256').update(Buffer.from(params.secret, 'hex')).digest('hex')
      });
      
      const escrow = new ethers.Contract(params.escrowAddress, BASE_ESCROW_ABI, this.wallet);
      const tx = await escrow.withdraw('0x' + params.secret);
      const receipt = await tx.wait();
      
      logger.info('Withdrawal successful', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      });
      
      return {
        success: true,
        txHash: receipt.hash,
        explorerUrl: `https://basescan.org/tx/${receipt.hash}`
      };
      
    } catch (error) {
      logger.error('Failed to withdraw from escrow', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Monitor escrow for deposits
   */
  async monitorEscrowDeposit(escrowAddress: string): Promise<boolean> {
    try {
      const escrow = new ethers.Contract(escrowAddress, BASE_ESCROW_ABI, this.provider);
      
      return new Promise((resolve) => {
        const filter = escrow.filters.Deposited();
        
        const timeout = setTimeout(() => {
          this.provider.off(filter);
          resolve(false);
        }, 300000); // 5 minute timeout
        
        this.provider.on(filter, (event) => {
          logger.info('Escrow deposit detected', { escrowAddress });
          clearTimeout(timeout);
          this.provider.off(filter);
          resolve(true);
        });
      });
      
    } catch (error) {
      logger.error('Failed to monitor escrow', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}