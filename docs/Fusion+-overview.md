1inch Fusion+ Cross-Chain Swap System

📃 Purpose

This document serves as the source of truth for a hackathon project extending 1inch Fusion+ with support for the Stellar blockchain, enabling bi-directional atomic swaps between Stellar and Base using custom-built HTLCs, resolver, and relayer components.

📊 Overview of Fusion+

1inch Fusion+ enables gasless, MEV-resistant, and trustless cross-chain swaps using:

Off-chain signed orders (intent-based swaps)

Dutch auctions for price discovery

Resolvers that compete to fill orders

HTLC-based escrows for atomicity

Support for partial fills, secret revelation, and recovery fallback

🧱 Hackathon Context

💼 Goals

You are building a full working prototype of Fusion+ between Stellar and Base.

⚠️ Constraints & Clarifications

You are not whitelisted as a resolver in the 1inch production network.

You are provided a 1inch API key to simulate auction/order flow.

You must run your own relayer and resolver.

Both Base and Stellar HTLCs are custom-built.

Execution will happen on mainnet or L2/testnet, not in simulation.

📌 Qualification Requirements Checklist

Requirement

Status

✅ Hashlock/Timelock support on non-EVM (Stellar)

Implemented via custom Stellar HTLC

✅ Bi-directional swaps (Stellar <-> Base)

Must demonstrate both flows

✅ Onchain execution during demo

Testnet deployments required

✅ Custom UI

Must display order, fill state, logs

✅ Partial fills support

Use Merkle-based secret scheme

📂 Key Components

🌐 Custom HTLC Contracts

Stellar

Built using Stellar smart signature logic

Stores: hash(s), amount, receiver, timelock

Functions:

lock(secret_hash)

claim(secret)

refund()

Base

Mimics 1inch's EVM-style HTLC in cross-chain-resolver-example

Parameters:

immutableArgs via CREATE2

Merkle proofs for partial fills

🪬 Resolver

Written in TypeScript

Watches Fusion+ order book (via 1inch API key)

Executes escrow contracts on both chains

Waits for relayer to reveal secret

Claims funds from both escrows

🔎 Relayer

Tracks:

Escrow creation on both chains

Confirms finality

Reveals secret to resolver upon success

May handle fallback logic (refund after timeout)

⚖️ Dutch Auction Engine

Provided via 1inch API

Orders configured using fusion-plus-order tool:

startPrice, endPrice, duration, resolverFee

Orders submitted with 1inch key

🪨 Execution Flow

Maker signs off-chain Fusion+ order with hash(secret)

Relayer broadcasts to custom resolvers

Resolver deposits:

Stellar escrow (maker tokens)

Base escrow (taker tokens + safety deposit)

Relayer tracks confirmations

Relayer reveals secret

Resolver claims funds from both escrows

If expired:

Cancel & return funds to respective parties

🚀 Testing Strategy

Use Goerli or Base Sepolia for EVM side

Use Stellar testnet (Futurenet or test network)

Trigger orders with known secrets to simulate full roundtrip

Monitor:

Escrow state

Timelock expiration

Partial fills using Merkle root structure

📍 References

cross-chain-resolver-example:https://github.com/1inch/cross-chain-resolver-example

fusion-plus-order:https://github.com/Tanz0rz/fusion-plus-order

Limit Order Protocol v3: https://github.com/1inch/limit-order-protocol


How Fusion+ Normally Works:

1inch Fusion+ Cross‑Chain Swap Architecture
📘 Overview
Fusion+ is an intent‑based, cross‑chain atomic swap system built atop the 1inch Limit Order Protocol (LOP) and Fusion framework. It uses Dutch auctions, hashlock/timelock escrows, and resolver competition to enable gasless, MEV‑protected, self‑custodial cross‑chain swaps without bridges or centralized custody. 
npm
+15
help.1inch.io
+15
portal.1inch.dev
+15

1. Key Actors & Components
Maker: User signing a Fusion+ order off‑chain, using it to declare swap intent.

Resolver (Taker): KYC/KYB‑approved actor who wins the Dutch auction and executes the on‑chain escrows and swaps. 
mixbytes.io
+2
1inch Network
+2
help.1inch.io
+2

Relayer Service: 1inch service broadcasting orders to resolvers, coordinating auction and secret revelation. 
blog.1inch.io
+15
1inch Network
+15
mixbytes.io
+15

Escrow Contracts: Deployed on source and destination chains; carry funds linked via a hashlock and protected by timelocks. Can use proxy/clones for gas efficiency via immutable calldata checks. 
1inch Network
+4
1inch Network
+4
mixbytes.io
+4

2. Protocol Phases
🔹 Phase 1: Announcement
Maker signs a Fusion+ order including:

hash(secret)

source and destination amounts & tokens

timelocks

target withdrawal address

auction presets, gas cost estimates 
GitHub
+12
1inch Network
+12
help.1inch.io
+12
GitHub
1inch Network
+7
mixbytes.io
+7
blog.1inch.io
+7

Order broadcast to resolvers via relayer initiating a Dutch auction.

Resolvers compete; winning resolver “locks in” order by creating source‑chain escrow. 
GitHub
+11
help.1inch.io
+11
mixbytes.io
+11

🔹 Phase 2: Deposit
Resolver deposits maker’s tokens into the source chain escrow, embedding hash(secret), timelock, target address.

Simultaneously, resolver deposits taker’s tokens into destination chain escrow, with same secret hash and a safety deposit as economic stake. 
1inch Network
+1
mixbytes.io
+1

🔹 Phase 3: Withdrawal
Relayer tracks finality for both escrows and then reveals the preimage (secret) to resolvers.

Using the revealed secret:

Resolver withdraws funds from destination escrow to maker.

Resolver retrieves maker tokens on source chain.

Escrow contracts verify valid timelock/secret, then release funds accordingly. 
help.1inch.io
+4
1inch Network
+4
mixbytes.io
+4
help.1inch.io

🔹 Phase 4: Recovery (Fallback)
If one side becomes unresponsive or timelock expires:

resolver or another eligible party triggers cancel on escrow.

Maker’s funds are returned; resolver forfeits safety deposit which is awarded to the actor who initiates recovery. 
1inch Network
+7
1inch Network
+7
mixbytes.io
+7
help.1inch.io
+1
1inch Network
+1

3. Secret & Partial‑Fill Handling
Maker generates and retains the secret, shared to relayer only after escrow creation.

For multi‑fill orders, secrets are organized in a Merkle tree:

Each fill has a unique secret.

Escrow checks via Merkle proof (MerkleStorageInvalidator.sol).

Escrow contracts deployed via immutable‑args clones (EIP‑1167). On every call, calldata immutables are verified via CREATE2 address check to prevent tampering. Saves gas across chains. 
BeInCrypto
+4
mixbytes.io
+4
1inch Network
+4

4. Auction Parameters & Gas Modeling
The Dutch auction uses presets defined by the maker (e.g. fair/custom).

Configurable: start price, bump rate, auction duration, constant-price zones.

Gas cost estimations are embedded and used to adjust auction curve so that resolver profitability accounts for expected gas. 
mixbytes.io
blog.1inch.io

5. Resolver Requirements & Compliance
Must pass KYC/KYB and agree to resolver terms.

Liquidity and activity are monitored for illicit activity mitigation.

Fees are optional and configurable by DAO, assigned to a specified address; can be zero. 
1inch Network
+1
1inch.dev
+1
1inch.dev
+1
1inch Network
+1

6. Fusion+ API & SDK Overview
Fusion+ API (hosted on api.1inch.dev/fusion) supports:

Quote fetch (getQuote)

Order creation and submission

Order status polling via getOrderStatus

Available in @1inch/fusion-sdk, last version v2.3.6 as of Aug 1, 2025. Sample code handles order lifecycle: from quote → order → tracking order filled or expired. 
YouTube
+15
GitHub
+15
1inch.dev
+15

7. Designing a Non‑EVM Extension
Here’s what you'll need to support in your integration for a non‑EVM chain:

Hashlock + Timelock escrow contract: ability to lock and redeem via hash preimage and block‑native time.

Deployable escrow clone system: minimal proxy pattern using deterministic addresses to verify parameters.

Merkle‑tree multi‑fill logic: handle secrets generation, Merkle proofs.

Secret sharing and relayer integration: maker secret management, relayer API usage to broadcast and receive secret.

Auction parameter parsing: support reading auction presets (duration, start/end price curve), gas model logic tuned to non‑EVM chain costs.

Finality detection: Ensuring both escrows reach finality before revealing secret. Integrate relayer or oracle to track chain confirmations.

Recovery handling: implement fallback cancellation logic triggered after timelock expiration to return locked funds and distribute safety deposit.

🧩 Architecture Diagram (Textual)
vbnet
Copy
Edit
Maker (dApp) → sign Fusion+ order (with secret hash) → Relayer
Relayer → broadcast to Resolvers → Dutch Auction
Winning Resolver:
    ↳ deposit Source chain escrow (maker funds)
    ↳ deposit Destination chain escrow (taker funds + safety)
    ↳ inform relayer escrow created
Relayer → watch finality → reveal secret
Resolver → withdraw destination funds to maker
Resolver → withdraw source funds to self
If timelock expires before completion →
    Recovery actor cancels escrows → returns funds → safety deposit awarded