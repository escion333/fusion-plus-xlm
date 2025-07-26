#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Bytes};

// Import modules
mod types;
mod errors;
mod events;
mod storage;
mod timelocks;

use types::*;
use errors::*;

// Native token address constants for different networks
// These are placeholder addresses - replace with actual native token addresses
#[allow(dead_code)]
const NATIVE_TOKEN_MAINNET: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
#[allow(dead_code)]
const NATIVE_TOKEN_TESTNET: &str = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

#[contract]
pub struct StellarEscrow;

#[contractimpl]
impl StellarEscrow {
    /// Initialize a new escrow with deterministic address calculation
    /// This function should be called by a factory contract that deploys this escrow
    /// with a deterministic address based on the immutables hash
    pub fn deploy(
        env: Env,
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Address {
        // Verify this is the first deployment (contract not already initialized)
        if storage::is_initialized(&env) {
            panic_with_error!(&env, Error::AlreadyInitialized);
        }
        
        // Create immutables struct
        let immutables = Immutables {
            order_hash: order_hash.clone(),
            hashlock: hashlock.clone(),
            maker: maker.clone(),
            taker: taker.clone(),
            token: token.clone(),
            amount,
            safety_deposit,
            timelocks,
        };

        // Store immutables
        storage::set_immutables(&env, &immutables);
        
        // Initialize state
        storage::set_state(&env, State::Active);
        
        // Emit creation event
        events::emit_escrow_created(&env, &order_hash, &maker, &taker);
        
        // Return the contract's own address
        env.current_contract_address()
    }
    
    /// Get the hash of the current escrow's immutables
    /// This can be used by external contracts to verify the escrow address
    pub fn get_immutables_hash(env: Env) -> BytesN<32> {
        let immutables = storage::get_immutables(&env);
        immutables.hash(&env)
    }

    /// Withdraw funds by revealing the secret
    pub fn withdraw(env: Env, secret: BytesN<32>, _unwrap_native: bool) {
        // Verify state is active
        let state = storage::get_state(&env);
        if state != State::Active {
            panic_with_error!(&env, Error::InvalidState);
        }

        // Get immutables
        let immutables = storage::get_immutables(&env);
        
        // Verify secret hash matches
        let secret_bytes = Bytes::from(secret.clone());
        let secret_hash = env.crypto().sha256(&secret_bytes);
        if secret_hash.to_bytes() != immutables.hashlock {
            panic_with_error!(&env, Error::InvalidSecret);
        }

        // Check timelock
        if !timelocks::can_withdraw(&env, &immutables.timelocks, false) {
            panic_with_error!(&env, Error::TimelockNotExpired);
        }

        // Transfer tokens to taker
        transfer_tokens(&env, &immutables.token, &immutables.taker, immutables.amount);
        
        // Return safety deposit to maker if any
        if immutables.safety_deposit > 0 {
            transfer_native(&env, &immutables.maker, immutables.safety_deposit);
        }

        // Update state
        storage::set_state(&env, State::Withdrawn);
        
        // Emit event
        events::emit_secret_revealed(&env, &secret);
    }

    /// Cancel escrow and return funds
    pub fn cancel(env: Env, caller: Address) {
        // Require authentication from the caller
        caller.require_auth();
        
        // Verify state is active
        let state = storage::get_state(&env);
        if state != State::Active {
            panic_with_error!(&env, Error::InvalidState);
        }

        // Get immutables
        let immutables = storage::get_immutables(&env);
        
        // Check if cancellation is allowed
        if !timelocks::can_cancel(&env, &immutables.timelocks, &caller, &immutables.maker, &immutables.taker) {
            panic_with_error!(&env, Error::CannotCancel);
        }

        // Return tokens to maker
        transfer_tokens(&env, &immutables.token, &immutables.maker, immutables.amount);
        
        // Return safety deposit to taker if any
        if immutables.safety_deposit > 0 {
            transfer_native(&env, &immutables.taker, immutables.safety_deposit);
        }

        // Update state
        storage::set_state(&env, State::Cancelled);
        
        // Emit event
        events::emit_escrow_cancelled(&env);
    }

    /// Public withdrawal after timelock expiry
    pub fn public_withdraw(env: Env, secret: BytesN<32>, caller: Address) {
        // Require authentication from the caller
        caller.require_auth();
        
        // Similar to withdraw but with public timelock check
        let state = storage::get_state(&env);
        if state != State::Active {
            panic_with_error!(&env, Error::InvalidState);
        }

        let immutables = storage::get_immutables(&env);
        
        // Verify secret
        let secret_bytes = Bytes::from(secret.clone());
        let secret_hash = env.crypto().sha256(&secret_bytes);
        if secret_hash.to_bytes() != immutables.hashlock {
            panic_with_error!(&env, Error::InvalidSecret);
        }

        // Check public withdrawal timelock
        if !timelocks::can_withdraw(&env, &immutables.timelocks, true) {
            panic_with_error!(&env, Error::TimelockNotExpired);
        }

        // Anyone can call this after public timelock
        
        // Transfer tokens to caller
        transfer_tokens(&env, &immutables.token, &caller, immutables.amount);
        
        // Safety deposit goes to original parties
        if immutables.safety_deposit > 0 {
            transfer_native(&env, &immutables.maker, immutables.safety_deposit / 2);
            transfer_native(&env, &immutables.taker, immutables.safety_deposit / 2);
        }

        storage::set_state(&env, State::Withdrawn);
        events::emit_secret_revealed(&env, &secret);
    }

    /// Get current escrow state
    pub fn get_state(env: Env) -> State {
        storage::get_state(&env)
    }

    /// Get escrow immutables
    pub fn get_immutables(env: Env) -> Immutables {
        storage::get_immutables(&env)
    }
}

// Helper functions
fn transfer_tokens(env: &Env, token: &Address, to: &Address, amount: i128) {
    // For native XLM
    if is_native_token(env, token) {
        transfer_native(env, to, amount);
    } else {
        // For other tokens, use token contract
        let client = soroban_sdk::token::TokenClient::new(env, token);
        client.transfer(&env.current_contract_address(), to, &amount);
    }
}

pub(crate) fn transfer_native(env: &Env, to: &Address, amount: i128) {
    // In Stellar/Soroban, native XLM is handled through the Stellar Asset Contract (SAC)
    // The native token has a special address that can be obtained through the SDK
    // For now, we'll use the token client with the native token address
    let native_token = get_native_token_address(env);
    let client = soroban_sdk::token::TokenClient::new(env, &native_token);
    client.transfer(&env.current_contract_address(), to, &amount);
}

pub(crate) fn is_native_token(env: &Env, token: &Address) -> bool {
    // Check if this is the native XLM token
    // In Stellar, we can compare with the native token address
    let native_token = get_native_token_address(env);
    token == &native_token
}

pub(crate) fn get_native_token_address(env: &Env) -> Address {
    // In Stellar, the native token (XLM) is represented by a special contract address
    // The SDK provides a way to get this address
    // For production, this would be a well-known constant address
    // For testing, we use env.register_stellar_asset_contract_v2
    
    // This is a placeholder address - in production, use the actual native token address
    // The actual address depends on the network (testnet vs mainnet)
    // For now, we'll use a dummy address that should be replaced with the correct one
    Address::from_string(&soroban_sdk::String::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"))
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod integration_test;