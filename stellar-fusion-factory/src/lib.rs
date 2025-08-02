#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, BytesN, Env, Symbol, log, symbol_short, vec, IntoVal,
};

// Error types for better handling
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    AlreadyDeployed = 3,
    InvalidParams = 4,
    DeploymentFailed = 5,
}

#[contracttype]
pub struct Immutables {
    pub order_hash: BytesN<32>,
    pub hashlock: BytesN<32>,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub timelocks: u64,
}

const ADMIN: Symbol = symbol_short!("ADMIN");
const HTLC_HASH: Symbol = symbol_short!("HTLC_HASH");
const NONCE: Symbol = symbol_short!("NONCE");
const DEPLOYED: Symbol = symbol_short!("DEPLOYED");

#[contract]
pub struct EscrowFactory;

#[contractimpl]
impl EscrowFactory {
    /// Initialize the factory with admin and HTLC WASM hash
    pub fn initialize(env: Env, admin: Address, htlc_wasm_hash: BytesN<32>) -> Result<(), Error> {
        // Check if already initialized
        if env.storage().instance().has(&ADMIN) {
            return Err(Error::AlreadyInitialized);
        }
        
        // Require admin authentication
        admin.require_auth();
        
        // Store admin and HTLC WASM hash
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&HTLC_HASH, &htlc_wasm_hash);
        env.storage().instance().set(&NONCE, &0u64);
        
        // Emit initialization event
        env.events().publish(
            (Symbol::new(&env, "initialized"),),
            (admin, htlc_wasm_hash),
        );
        
        Ok(())
    }
    
    /// Update the HTLC WASM hash (admin only)
    pub fn update_htlc_hash(env: Env, new_hash: BytesN<32>) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&ADMIN)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&HTLC_HASH, &new_hash);
        
        env.events().publish(
            (Symbol::new(&env, "htlc_hash_updated"),),
            new_hash,
        );
        
        Ok(())
    }
    
    /// Deploy an escrow contract with client-provided salt
    pub fn deploy_escrow(
        env: Env,
        salt: BytesN<32>,  // Client computes this off-chain using keccak256
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Result<Address, Error> {
        // Get the HTLC WASM hash
        let htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&HTLC_HASH)
            .ok_or(Error::NotInitialized)?;
        
        // Check if already deployed with this salt
        let deployed_key = (DEPLOYED, salt.clone());
        if env.storage().persistent().has(&deployed_key) {
            let existing_address: Address = env.storage().persistent().get(&deployed_key).unwrap();
            log!(&env, "Escrow already deployed at: {}", existing_address);
            return Err(Error::AlreadyDeployed);
        }
        
        // Deploy the escrow contract with deterministic address
        let escrow = env.deployer()
            .with_current_contract(salt.clone())
            .deploy_v2(htlc_wasm_hash, ());
        
        // Store deployed address
        env.storage().persistent().set(&deployed_key, &escrow);
        
        // Initialize the escrow by calling its deploy function
        let _: () = env.invoke_contract(
            &escrow,
            &Symbol::new(&env, "deploy"),
            vec![
                &env,
                order_hash.to_val(),
                hashlock.to_val(),
                maker.to_val(),
                taker.to_val(),
                token.to_val(),
                amount.into_val(&env),
                safety_deposit.into_val(&env),
                timelocks.into_val(&env),
            ],
        );
        
        // Emit event
        env.events().publish(
            (Symbol::new(&env, "escrow_deployed"),),
            (escrow.clone(), order_hash, salt),
        );
        
        Ok(escrow)
    }
    
    /// Calculate the address that would be generated for given salt
    pub fn calculate_escrow_address(
        env: Env,
        salt: BytesN<32>,  // Client provides pre-computed salt
    ) -> Result<Address, Error> {
        // Verify factory is initialized
        let _htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&HTLC_HASH)
            .ok_or(Error::NotInitialized)?;
        
        // Check if would collide
        let deployed_key = (DEPLOYED, salt.clone());
        if env.storage().persistent().has(&deployed_key) {
            return Err(Error::AlreadyDeployed);
        }
        
        // Calculate the deterministic address
        Ok(env.deployer()
            .with_current_contract(salt)
            .deployed_address())
    }
    
    /// Get the current HTLC WASM hash
    pub fn get_htlc_hash(env: Env) -> Result<BytesN<32>, Error> {
        env.storage().instance()
            .get(&HTLC_HASH)
            .ok_or(Error::NotInitialized)
    }
    
    /// Get the admin address
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage().instance()
            .get(&ADMIN)
            .ok_or(Error::NotInitialized)
    }
    
    /// Check if an escrow is already deployed with given salt
    pub fn is_deployed(env: Env, salt: BytesN<32>) -> bool {
        let deployed_key = (DEPLOYED, salt);
        env.storage().persistent().has(&deployed_key)
    }
}