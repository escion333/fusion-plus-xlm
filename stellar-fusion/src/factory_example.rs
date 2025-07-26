// Example factory contract for deploying escrows with deterministic addresses
// This demonstrates how a factory would deploy escrow contracts deterministically

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env};

#[contract]
pub struct EscrowFactory;

#[contractimpl]
impl EscrowFactory {
    /// Deploy an escrow contract with deterministic address
    /// The address is determined by the factory address and the immutables hash
    pub fn deploy_escrow(
        env: Env,
        escrow_wasm_hash: BytesN<32>,
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Address {
        // Create immutables for hashing
        let immutables = crate::types::Immutables {
            order_hash: order_hash.clone(),
            hashlock: hashlock.clone(),
            maker: maker.clone(),
            taker: taker.clone(),
            token: token.clone(),
            amount,
            safety_deposit,
            timelocks,
        };
        
        // Calculate salt from immutables hash
        let salt = immutables.hash(&env);
        
        // Deploy the escrow contract with deterministic address
        let escrow = env.deployer()
            .with_current_contract(salt)
            .deploy(escrow_wasm_hash);
        
        // Initialize the escrow
        let client = crate::StellarEscrowClient::new(&env, &escrow);
        client.deploy(
            &order_hash,
            &hashlock,
            &maker,
            &taker,
            &token,
            &amount,
            &safety_deposit,
            &timelocks,
        );
        
        escrow
    }
    
    /// Calculate the address that would be generated for given immutables
    /// This allows anyone to predict the escrow address before deployment
    pub fn calculate_escrow_address(
        env: Env,
        escrow_wasm_hash: BytesN<32>,
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Address {
        // Create immutables for hashing
        let immutables = crate::types::Immutables {
            order_hash,
            hashlock,
            maker,
            taker,
            token,
            amount,
            safety_deposit,
            timelocks,
        };
        
        // Calculate salt from immutables hash
        let salt = immutables.hash(&env);
        
        // Calculate the deterministic address
        env.deployer()
            .with_current_contract(salt)
            .deployed_address(escrow_wasm_hash)
    }
}