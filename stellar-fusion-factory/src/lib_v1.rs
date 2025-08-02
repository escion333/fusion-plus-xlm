#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, BytesN, Env, Symbol, Vec, log,
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

#[contract]
pub struct EscrowFactory;

#[contractimpl]
impl EscrowFactory {
    /// Initialize the factory with admin and HTLC WASM hash
    pub fn initialize(env: Env, admin: Address, htlc_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let admin_key = Symbol::new(&env, "ADMIN");
        let htlc_key = Symbol::new(&env, "HTLC_HASH");
        let nonce_key = Symbol::new(&env, "NONCE");
        
        // Check if already initialized
        if env.storage().instance().has(&admin_key) {
            return Err(Error::AlreadyInitialized);
        }
        
        // Require admin authentication
        admin.require_auth();
        
        // Store admin and HTLC WASM hash
        env.storage().instance().set(&admin_key, &admin);
        env.storage().instance().set(&htlc_key, &htlc_wasm_hash);
        env.storage().instance().set(&nonce_key, &0u64);
        
        // Emit initialization event
        env.events().publish(
            (Symbol::new(&env, "initialized"),),
            (admin, htlc_wasm_hash),
        );
        
        Ok(())
    }
    
    /// Update the HTLC WASM hash (admin only)
    pub fn update_htlc_hash(env: Env, new_hash: BytesN<32>) -> Result<(), Error> {
        let admin_key = Symbol::new(&env, "ADMIN");
        let htlc_key = Symbol::new(&env, "HTLC_HASH");
        
        let admin: Address = env.storage().instance()
            .get(&admin_key)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();
        
        env.storage().instance().set(&htlc_key, &new_hash);
        
        env.events().publish(
            (Symbol::new(&env, "htlc_hash_updated"),),
            new_hash,
        );
        
        Ok(())
    }
    
    /// Deploy an escrow contract with deterministic address
    pub fn deploy_escrow(
        env: Env,
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Result<Address, Error> {
        let htlc_key = Symbol::new(&env, "HTLC_HASH");
        let nonce_key = Symbol::new(&env, "NONCE");
        
        // Get the HTLC WASM hash
        let htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&htlc_key)
            .ok_or(Error::NotInitialized)?;
        
        // Get and increment nonce for uniqueness
        let nonce: u64 = env.storage().instance().get(&nonce_key).unwrap_or(0);
        env.storage().instance().set(&nonce_key, &(nonce + 1));
        
        // Add timestamp for additional uniqueness
        let timestamp = env.ledger().timestamp();
        
        // Create unique salt by combining all parameters
        let mut salt_components = Vec::new(&env);
        salt_components.push_back(order_hash.to_val());
        salt_components.push_back(hashlock.to_val());
        salt_components.push_back(maker.to_val());
        salt_components.push_back(taker.to_val());
        salt_components.push_back(token.to_val());
        salt_components.push_back(amount);
        salt_components.push_back(safety_deposit);
        salt_components.push_back(timelocks);
        salt_components.push_back(nonce);
        salt_components.push_back(timestamp);
        
        // Hash the components to create salt
        let salt_bytes = env.crypto().keccak256(&salt_components.to_bytes());
        
        // Check if already deployed with this exact configuration
        let deployed_key = (Symbol::new(&env, "deployed"), salt_bytes.clone());
        if env.storage().persistent().has(&deployed_key) {
            let existing_address: Address = env.storage().persistent().get(&deployed_key).unwrap();
            log!(&env, "Escrow already deployed at: {}", existing_address);
            return Err(Error::AlreadyDeployed);
        }
        
        // Deploy the escrow contract with deterministic address
        let deploy_result = env.deployer()
            .with_current_contract(salt_bytes.clone())
            .deploy_v2(
                htlc_wasm_hash,
                (&order_hash, &hashlock, &maker, &taker, &token, &amount, &safety_deposit, &timelocks),
            );
        
        match deploy_result {
            Ok(escrow) => {
                // Store deployed address
                env.storage().persistent().set(&deployed_key, &escrow);
                
                // Emit event
                env.events().publish(
                    (Symbol::new(&env, "escrow_deployed"),),
                    (escrow.clone(), order_hash, salt_bytes, nonce, timestamp),
                );
                Ok(escrow)
            },
            Err(_) => {
                log!(&env, "Deployment failed");
                Err(Error::DeploymentFailed)
            }
        }
    }
    
    /// Calculate the address that would be generated for given immutables
    /// This now returns an error if the escrow would collide
    pub fn calculate_escrow_address(
        env: Env,
        order_hash: BytesN<32>,
        hashlock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: u64,
    ) -> Result<Address, Error> {
        let htlc_key = Symbol::new(&env, "HTLC_HASH");
        let nonce_key = Symbol::new(&env, "NONCE");
        
        // Get the HTLC WASM hash (verifies factory is initialized)
        let _htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&htlc_key)
            .ok_or(Error::NotInitialized)?;
        
        // Get current nonce (don't increment yet)
        let nonce: u64 = env.storage().instance().get(&nonce_key).unwrap_or(0);
        let timestamp = env.ledger().timestamp();
        
        // Create the same salt calculation as deploy
        let mut salt_components = Vec::new(&env);
        salt_components.push_back(order_hash.to_val());
        salt_components.push_back(hashlock.to_val());
        salt_components.push_back(maker.to_val());
        salt_components.push_back(taker.to_val());
        salt_components.push_back(token.to_val());
        salt_components.push_back(amount);
        salt_components.push_back(safety_deposit);
        salt_components.push_back(timelocks);
        salt_components.push_back(nonce);
        salt_components.push_back(timestamp);
        
        let salt_bytes = env.crypto().keccak256(&salt_components.to_bytes());
        
        // Check if would collide
        let deployed_key = (Symbol::new(&env, "deployed"), salt_bytes.clone());
        if env.storage().persistent().has(&deployed_key) {
            return Err(Error::AlreadyDeployed);
        }
        
        // Calculate the deterministic address
        Ok(env.deployer()
            .with_current_contract(salt_bytes)
            .deployed_address())
    }
    
    /// Get the current HTLC WASM hash
    pub fn get_htlc_hash(env: Env) -> Result<BytesN<32>, Error> {
        let htlc_key = Symbol::new(&env, "HTLC_HASH");
        env.storage().instance()
            .get(&htlc_key)
            .ok_or(Error::NotInitialized)
    }
    
    /// Get the admin address
    pub fn get_admin(env: Env) -> Result<Address, Error> {
        let admin_key = Symbol::new(&env, "ADMIN");
        env.storage().instance()
            .get(&admin_key)
            .ok_or(Error::NotInitialized)
    }
    
    /// Get current nonce
    pub fn get_nonce(env: Env) -> u64 {
        let nonce_key = Symbol::new(&env, "NONCE");
        env.storage().instance().get(&nonce_key).unwrap_or(0)
    }
}