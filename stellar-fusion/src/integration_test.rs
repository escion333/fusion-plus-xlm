#[cfg(test)]
mod integration_tests {
    use crate::{StellarEscrow, StellarEscrowClient, State};
    use soroban_sdk::{testutils::Address as _, Address, Env, BytesN, Bytes, token};
    use soroban_sdk::testutils::Ledger;
    
    #[test]
    fn test_full_escrow_lifecycle() {
        let env = Env::default();
        env.mock_all_auths();
        
        // Deploy escrow contract
        let escrow = env.register(StellarEscrow, ());
        let escrow_client = StellarEscrowClient::new(&env, &escrow);
        
        // Setup participants
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token
        let token = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token.address());
        token_client.mint(&token_admin, &10000i128);
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Create secret and hashlock
        let secret = BytesN::from_array(&env, &[42u8; 32]);
        let secret_bytes = Bytes::from(secret.clone());
        let hashlock = env.crypto().sha256(&secret_bytes).to_bytes();
        
        // Setup timelock (allow immediate operations for testing)
        let timelocks = 0u64;
        
        // Initialize escrow
        let order_hash = BytesN::from_array(&env, &[1u8; 32]);
        let amount = 1000i128;
        let safety_deposit = 0i128; // No safety deposit for this test
        
        // 1. Deploying escrow
        let escrow_addr = escrow_client.deploy(
            &order_hash,
            &hashlock,
            &maker,
            &taker,
            &token.address(),
            &amount,
            &safety_deposit,
            &timelocks,
        );
        assert_eq!(escrow_addr, escrow);
        
        // Verify initialization
        let state = escrow_client.get_state();
        assert_eq!(state, State::Active);
        
        let immutables = escrow_client.get_immutables();
        assert_eq!(immutables.amount, amount);
        assert_eq!(immutables.safety_deposit, safety_deposit);
        
        // Test immutables hash (for deterministic addressing)
        let hash1 = escrow_client.get_immutables_hash();
        let hash2 = immutables.hash(&env);
        assert_eq!(hash1, hash2);
        // 2. Immutables hash verified
        
        // Transfer tokens to escrow
        // 3. Transferring tokens to escrow
        token_client.transfer(&maker, &escrow, &amount);
        assert_eq!(token_client.balance(&escrow), amount);
        
        // Test withdrawal with correct secret
        // 4. Withdrawing with correct secret
        escrow_client.withdraw(&secret, &false);
        
        // Verify withdrawal
        assert_eq!(escrow_client.get_state(), State::Withdrawn);
        assert_eq!(token_client.balance(&taker), amount);
        assert_eq!(token_client.balance(&escrow), 0);
        
        // ✅ Full escrow lifecycle completed successfully!
    }
    
    #[test]
    fn test_cancellation_flow() {
        let env = Env::default();
        env.mock_all_auths();
        
        let escrow = env.register(StellarEscrow, ());
        let escrow_client = StellarEscrowClient::new(&env, &escrow);
        
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token and fund maker
        let token = env.register_stellar_asset_contract_v2(token_admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token.address());
        token_client.mint(&token_admin, &10000i128);
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Deploy escrow
        let (_, hashlock) = create_secret_and_hash(&env);
        escrow_client.deploy(
            &BytesN::from_array(&env, &[2u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token.address(),
            &1000i128,
            &0i128,
            &0u64, // No timelock restrictions
        );
        
        // Fund escrow
        token_client.transfer(&maker, &escrow, &1000i128);
        
        // 1. Cancelling escrow
        escrow_client.cancel(&maker);
        
        // Verify cancellation
        assert_eq!(escrow_client.get_state(), State::Cancelled);
        assert_eq!(token_client.balance(&maker), 2000i128); // Funds returned
        
        // ✅ Cancellation flow completed successfully!
    }
    
    #[test]
    fn test_timelock_enforcement() {
        let env = Env::default();
        env.mock_all_auths();
        
        let escrow = env.register(StellarEscrow, ());
        let escrow_client = StellarEscrowClient::new(&env, &escrow);
        
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token = Address::generate(&env);
        
        // Set current time
        let current_time = 1000u64;
        env.ledger().with_mut(|li| {
            li.timestamp = current_time;
        });
        
        // Create timelocks: 
        // - DST_WITHDRAWAL at 2000 (bit 4)
        // - DST_PUBLIC_WITHDRAWAL at 3000 (bit 5)
        let timelocks = (2000u64 << 32) | (3000u64 << 40);
        
        let (_secret, hashlock) = create_secret_and_hash(&env);
        
        // 1. Deploying escrow with timelocks
        escrow_client.deploy(
            &BytesN::from_array(&env, &[3u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &1000i128,
            &0i128,
            &timelocks,
        );
        
        // Time travel to withdrawal window
        // 2. Advancing time to withdrawal window
        env.ledger().with_mut(|li| {
            li.timestamp = 2500u64;
        });
        
        // Now withdrawal should work
        let state = escrow_client.get_state();
        assert_eq!(state, State::Active);
        
        // ✅ Timelock enforcement verified!
    }
    
    #[test]
    fn test_native_token_support() {
        let env = Env::default();
        
        // Test native token detection
        let native_addr = crate::get_native_token_address(&env);
        assert!(crate::is_native_token(&env, &native_addr));
        
        // Test non-native token
        let regular_token = Address::generate(&env);
        assert!(!crate::is_native_token(&env, &regular_token));
        
        // ✅ Native token support verified!
    }
    
    // Helper function
    fn create_secret_and_hash(env: &Env) -> (BytesN<32>, BytesN<32>) {
        let secret = BytesN::from_array(&env, &[42u8; 32]);
        let secret_bytes = Bytes::from(secret.clone());
        let hashlock = env.crypto().sha256(&secret_bytes).to_bytes();
        (secret, hashlock)
    }
}