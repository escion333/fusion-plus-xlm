# Deployed Contracts

## Base Mainnet (Chain ID: 8453)

| Contract | Address | Description |
|----------|---------|-------------|
| Resolver | 0x8Da2180238380Fcf16Af6e6d9c8d2620E5093dA1 | Main resolver contract |
| HTLCEscrowFactory | 0xEe269949275B9b9C2c65e15922CC1F12ED82666E | HTLC-aware escrow factory |
| HTLCEscrow Implementation | 0xA4A8E9Df19Be6ea005C20744333837601fFD3FeC | Logic contract for escrows |
| USDC | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | Native USDC on Base |

## Stellar Mainnet

| Contract | ID | Description |
|----------|---------|-------------|
| Factory | CC6U5XPOVLDYZYDDPVR6QAQB73IRDJVENOLWDT52EY42ZBVJHPS7GQDO | Stellar escrow factory (v2 - SDK 23.0) |
| USDC | CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 | Stellar USDC |

## Contract Interfaces

### HTLCEscrowFactory
- `deployEscrow(Immutables)`: Deploy new HTLC escrow
- `predictEscrow(orderHash)`: Get deterministic escrow address
- `getEscrowAddress(...)`: Calculate escrow address from parameters

### HTLCEscrow
- `initialize(Immutables)`: Initialize escrow parameters
- `deposit()`: Deposit funds (maker)
- `withdraw(secret)`: Withdraw with secret (taker)
- `refund()`: Refund after timelock (maker)

## Deployment History
- 2025-08-02: Deployed HTLCEscrowFactory to Base mainnet