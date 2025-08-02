#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    Address, BytesN, Env, Symbol, Vec, log,
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
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

const ADMIN: Symbol = Symbol::short("ADMIN");
const HTLC_HASH: Symbol = Symbol::short("HTLC_HASH");
const NONCE: Symbol = Symbol::short("NONCE");
const DEPLOYED: Symbol = Symbol::short("DEPLOYED");

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
        // Get the HTLC WASM hash
        let htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&HTLC_HASH)
            .ok_or(Error::NotInitialized)?;
        
        // Get and increment nonce for uniqueness
        let nonce: u64 = env.storage().instance().get(&NONCE).unwrap_or(0);
        env.storage().instance().set(&NONCE, &(nonce + 1));
        
        // Add timestamp for additional uniqueness
        let timestamp = env.ledger().timestamp();
        
        // Create immutables for hashing with nonce and timestamp
        let mut salt_data = Vec::new(&env);
        salt_data.push_back(order_hash.clone().into_val(&env));
        salt_data.push_back(hashlock.clone().into_val(&env));
        salt_data.push_back(maker.clone().into_val(&env));
        salt_data.push_back(taker.clone().into_val(&env));
        salt_data.push_back(token.clone().into_val(&env));
        salt_data.push_back(amount.into_val(&env));
        salt_data.push_back(safety_deposit.into_val(&env));
        salt_data.push_back(timelocks.into_val(&env));
        salt_data.push_back(nonce.into_val(&env));
        salt_data.push_back(timestamp.into_val(&env));
        
        // Calculate unique salt
        let salt = env.crypto().hash_from_bytes(&salt_data.to_bytes());
        
        // Check if already deployed with this exact configuration
        let deployed_key = (Symbol::new(&env, "deployed"), salt.clone());
        if env.storage().persistent().has(&deployed_key) {
            let existing_address: Address = env.storage().persistent().get(&deployed_key).unwrap();
            log!(&env, "Escrow already deployed at: {}", existing_address);
            return Err(Error::AlreadyDeployed);
        }
        
        // Deploy the escrow contract with deterministic address
        let escrow = match env.deployer()
            .with_current_contract(salt.clone())
            .deploy_v2(htlc_wasm_hash, ()) {
            Ok(addr) => addr,
            Err(_) => {
                log!(&env, "Deployment failed for salt: {:?}", salt);
                return Err(Error::DeploymentFailed);
            }
        };
        
        // Store deployed address
        env.storage().persistent().set(&deployed_key, &escrow);
        
        // Initialize the escrow by calling its deploy function
        let init_args = vec![
            &env,
            order_hash.into_val(&env),
            hashlock.into_val(&env),
            maker.into_val(&env),
            taker.into_val(&env),
            token.into_val(&env),
            amount.into_val(&env),
            safety_deposit.into_val(&env),
            timelocks.into_val(&env),
        ];
        
        match env.invoke_contract::<Address>(
            &escrow,
            &Symbol::new(&env, "deploy"),
            init_args,
        ) {
            Ok(_) => {
                // Emit event
                env.events().publish(
                    (Symbol::new(&env, "escrow_deployed"),),
                    (escrow.clone(), order_hash, salt, nonce, timestamp),
                );
                Ok(escrow)
            },
            Err(_) => {
                log!(&env, "Failed to initialize escrow contract");
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
        // Get the HTLC WASM hash (not needed for address calculation, but verifies it exists)
        let _htlc_wasm_hash: BytesN<32> = env.storage().instance()
            .get(&HTLC_HASH)
            .ok_or(Error::NotInitialized)?;
        
        // Get current nonce (don't increment yet)
        let nonce: u64 = env.storage().instance().get(&NONCE).unwrap_or(0);
        let timestamp = env.ledger().timestamp();
        
        // Create the same salt calculation as deploy
        let mut salt_data = Vec::new(&env);
        salt_data.push_back(order_hash.into_val(&env));
        salt_data.push_back(hashlock.into_val(&env));
        salt_data.push_back(maker.into_val(&env));
        salt_data.push_back(taker.into_val(&env));
        salt_data.push_back(token.into_val(&env));
        salt_data.push_back(amount.into_val(&env));
        salt_data.push_back(safety_deposit.into_val(&env));
        salt_data.push_back(timelocks.into_val(&env));
        salt_data.push_back(nonce.into_val(&env));
        salt_data.push_back(timestamp.into_val(&env));
        
        let salt = env.crypto().hash_from_bytes(&salt_data.to_bytes());
        
        // Check if would collide
        let deployed_key = (Symbol::new(&env, "deployed"), salt.clone());
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
    
    /// Get current nonce
    pub fn get_nonce(env: Env) -> u64 {
        env.storage().instance().get(&NONCE).unwrap_or(0)
    }
    
    /// Check if an escrow is already deployed with given salt
    pub fn is_deployed(env: Env, salt: BytesN<32>) -> bool {
        let deployed_key = (Symbol::new(&env, "deployed"), salt);
        env.storage().persistent().has(&deployed_key)
    }
}