// Chain IDs
export const ETHEREUM_CHAIN_ID = 1;
export const BSC_CHAIN_ID = 56;
export const STELLAR_CHAIN_ID = 1001; // Custom ID for Stellar

export const config = {
    chain: {
        source: {
            chainId: ETHEREUM_CHAIN_ID,
            url: process.env.SRC_CHAIN_RPC || 'https://eth.merkle.io',
            createFork: true,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            tokens: {
                USDC: {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    donor: '0xd54F23BE482D9A58676590fCa79c8E43087f92fB'
                }
            }
        },
        stellar: {
            chainId: STELLAR_CHAIN_ID,
            url: 'https://horizon.stellar.org',
            testnet: false,
            resolverContract: 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU', // Mainnet HTLC
            tokens: {
                USDC: {
                    address: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
                    issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN'
                },
                XLM: {
                    address: 'native',
                    issuer: null
                }
            }
        }
    }
} as const;

export type ChainConfig = typeof config.chain['source' | 'stellar'];