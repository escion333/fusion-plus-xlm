import { ExtendedRelayer, CrossChainOrder } from './ExtendedRelayer';
import { STELLAR_CHAIN_ID } from './config';
import Sdk from '@1inch/cross-chain-sdk';

async function demoEthereumToStellarSwap() {
    console.log('=== Demo: Ethereum -> Stellar Cross-Chain Swap ===\n');
    
    // Initialize extended relayer
    const relayer = new ExtendedRelayer();
    
    // Create a mock order (in real implementation, this comes from 1inch order system)
    const order: CrossChainOrder = {
        srcChainId: Sdk.NetworkEnum.ETHEREUM,
        dstChainId: STELLAR_CHAIN_ID,
        orderHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        maker: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // User
        taker: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', // Resolver
        makerAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC on Ethereum
        takerAsset: 'USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', // USDC on Stellar
        makingAmount: BigInt('100000000'), // 100 USDC (6 decimals)
        takingAmount: BigInt('99000000'),  // 99 USDC (6 decimals)
        hashLock: '0x' + 'a'.repeat(64), // Mock hashlock
    };
    
    console.log('Order Details:');
    console.log('- From: Ethereum USDC');
    console.log('- To: Stellar USDC');
    console.log('- Amount: 100 USDC');
    console.log('- Rate: 0.99 (1% fee)\n');
    
    // Process the order
    await relayer.handleOrder(order);
    
    console.log('\n✅ Cross-chain swap completed successfully!');
}

async function demoStellarToEthereumSwap() {
    console.log('\n=== Demo: Stellar -> Ethereum Cross-Chain Swap ===\n');
    
    const relayer = new ExtendedRelayer();
    
    const order: CrossChainOrder = {
        srcChainId: STELLAR_CHAIN_ID,
        dstChainId: Sdk.NetworkEnum.ETHEREUM,
        orderHash: '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
        maker: 'GBFZR4HFQPZQHGKZYQSV3WHJRKJPXNCBNCNVWHJSZUQJEJDZVIHDTEST', // Stellar user
        taker: 'GCQTGZQQ5G4PTM2GL7CDIFKUBIPEC52BROAQIAPW53XBRJVN6ZJVTEX6V', // Stellar resolver
        makerAsset: 'native', // XLM
        takerAsset: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH on Ethereum
        makingAmount: BigInt('1000000000'), // 100 XLM (7 decimals)
        takingAmount: BigInt('50000000000000000'), // 0.05 ETH (18 decimals)
        hashLock: '0x' + 'b'.repeat(64),
    };
    
    console.log('Order Details:');
    console.log('- From: Stellar XLM');
    console.log('- To: Ethereum ETH');
    console.log('- Amount: 100 XLM');
    console.log('- Rate: 0.0005 ETH/XLM\n');
    
    await relayer.handleOrder(order);
    
    console.log('\n✅ Cross-chain swap completed successfully!');
}

// Run demos
async function main() {
    try {
        await demoEthereumToStellarSwap();
        await demoStellarToEthereumSwap();
    } catch (error) {
        console.error('Demo failed:', error);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}