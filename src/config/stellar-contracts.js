"use strict";
/**
 * Stellar contract addresses and configuration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STELLAR_CONTRACTS = void 0;
exports.getStellarContracts = getStellarContracts;
exports.isFactoryConfigured = isFactoryConfigured;
exports.STELLAR_CONTRACTS = {
    // Factory contract for deploying HTLC escrows
    FACTORY: {
        MAINNET: process.env.STELLAR_FACTORY_MAINNET || '', // To be deployed
        TESTNET: process.env.STELLAR_FACTORY_TESTNET || '', // To be deployed
    },
    // HTLC template WASM hash
    HTLC_WASM_HASH: 'a2b1fe28fe6bcdad4bd7c2f5a0955f4b943ee0045f638b4bccf4e6eb638dc2a8',
    // Legacy single-use HTLC (deprecated - DO NOT USE)
    LEGACY_HTLC: {
        MAINNET: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU',
        WARNING: 'This is a single-use contract already in Withdrawn state. Use factory instead.'
    },
    // Native token addresses
    NATIVE_TOKEN: {
        MAINNET: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
        TESTNET: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    },
    // USDC token addresses
    USDC: {
        MAINNET: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75', // Circle USDC on Stellar
        TESTNET: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA', // Test USDC
    }
};
/**
 * Get the appropriate contract addresses for the current network
 */
function getStellarContracts(network) {
    return {
        factory: exports.STELLAR_CONTRACTS.FACTORY[network.toUpperCase()],
        htlcWasmHash: exports.STELLAR_CONTRACTS.HTLC_WASM_HASH,
        nativeToken: exports.STELLAR_CONTRACTS.NATIVE_TOKEN[network.toUpperCase()],
        usdc: exports.STELLAR_CONTRACTS.USDC[network.toUpperCase()],
    };
}
/**
 * Check if factory is configured
 */
function isFactoryConfigured(network) {
    const contracts = getStellarContracts(network);
    return !!contracts.factory;
}
