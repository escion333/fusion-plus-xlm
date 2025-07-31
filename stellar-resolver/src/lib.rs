#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, BytesN, Env, Symbol, Vec,
};

#[derive(Clone)]
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
pub struct ResolverContract;

#[contractimpl]
impl ResolverContract {
    /// Initialize the resolver with owner and HTLC contract reference
    pub fn initialize(env: Env, owner: Address, htlc_contract: Address) {
        owner.require_auth();
        
        env.storage().instance().set(&Symbol::new(&env, "owner"), &owner);
        env.storage().instance().set(&Symbol::new(&env, "htlc"), &htlc_contract);
    }

    /// Deploy a new escrow on Stellar (no LOP here, direct deployment)
    pub fn deploy_escrow(
        env: Env,
        immutables: Immutables,
    ) -> Address {
        // Verify caller is owner
        let owner: Address = env.storage().instance().get(&Symbol::new(&env, "owner")).unwrap();
        owner.require_auth();
        
        // Get HTLC contract address
        let htlc_contract: Address = env.storage().instance().get(&Symbol::new(&env, "htlc")).unwrap();
        
        // Call HTLC contract to deploy escrow
        // In real implementation, this would call the HTLC contract's deploy function
        // For now, we'll store the escrow details and return the HTLC address
        env.storage().persistent().set(&immutables.order_hash, &immutables);
        
        // Emit event
        env.events().publish((Symbol::new(&env, "escrow_deployed"),), (
            immutables.order_hash.clone(),
            immutables.maker.clone(),
            immutables.taker.clone(),
            immutables.amount,
        ));
        
        htlc_contract
    }
    
    /// Fund an escrow with tokens
    pub fn fund_escrow(
        env: Env,
        escrow: Address,
        token: Address,
        amount: i128,
    ) {
        let owner: Address = env.storage().instance().get(&Symbol::new(&env, "owner")).unwrap();
        owner.require_auth();
        
        // Transfer tokens from resolver to escrow
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&owner, &escrow, &amount);
        
        // Emit event
        env.events().publish((Symbol::new(&env, "escrow_funded"),), (
            escrow.clone(),
            token.clone(),
            amount,
        ));
    }
    
    /// Withdraw from escrow using revealed secret
    pub fn withdraw(
        env: Env,
        escrow: Address,
        secret: BytesN<32>,
    ) {
        // Anyone can call withdraw with the correct secret
        // The HTLC contract will verify the secret
        
        // In real implementation, this would call the HTLC contract's withdraw function
        // For demonstration, we emit an event
        env.events().publish((Symbol::new(&env, "withdraw_initiated"),), (
            escrow.clone(),
            env.current_contract_address(),
        ));
    }
    
    /// Cancel escrow after timelock expiry
    pub fn cancel(
        env: Env,
        escrow: Address,
    ) {
        // Anyone can call cancel after timelock
        // The HTLC contract will verify the timelock
        
        env.events().publish((Symbol::new(&env, "cancel_initiated"),), (
            escrow.clone(),
            env.current_contract_address(),
        ));
    }
    
    /// Get owner address
    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, "owner")).unwrap()
    }
    
    /// Get HTLC contract address
    pub fn get_htlc(env: Env) -> Address {
        env.storage().instance().get(&Symbol::new(&env, "htlc")).unwrap()
    }
}
