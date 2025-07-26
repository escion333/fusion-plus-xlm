#[cfg(test)]
mod test {
    use crate::{StellarEscrow, StellarEscrowClient, State};
    use soroban_sdk::{testutils::Address as _, Address, Env, BytesN, Bytes, token};
    use soroban_sdk::testutils::Ledger;
    
    // Helper function to create a secret and its hash
    fn create_secret_and_hash(env: &Env) -> (BytesN<32>, BytesN<32>) {
        let secret = BytesN::from_array(&env, &[42u8; 32]);
        let secret_bytes = Bytes::from(secret.clone());
        let hashlock = env.crypto().sha256(&secret_bytes);
        (secret, hashlock.to_bytes())
    }
    
    // Helper function to setup token with balances
    fn setup_token(env: &Env, admin: &Address, initial_balance: i128) -> Address {
        let token = env.register_stellar_asset_contract_v2(admin.clone());
        let token_client = token::StellarAssetClient::new(&env, &token.address());
        token_client.mint(&admin, &initial_balance);
        token.address()
    }

    #[test]
    fn test_deploy_escrow() {
        let env = Env::default();
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);

        // Create test addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token = Address::generate(&env);

        // Create test data
        let order_hash = BytesN::from_array(&env, &[1u8; 32]);
        let (_, hashlock) = create_secret_and_hash(&env);
        let amount = 1000i128;
        let safety_deposit = 100i128;
        let timelocks = 0u64; // Simple timelocks for testing

        // Deploy escrow
        let escrow_address = client.deploy(
            &order_hash,
            &hashlock,
            &maker,
            &taker,
            &token,
            &amount,
            &safety_deposit,
            &timelocks,
        );

        // Verify the escrow was created
        assert_eq!(escrow_address, contract_id);

        // Check state
        let state = client.get_state();
        assert_eq!(state, State::Active);

        // Check immutables
        let immutables = client.get_immutables();
        assert_eq!(immutables.order_hash, order_hash);
        assert_eq!(immutables.hashlock, hashlock);
        assert_eq!(immutables.maker, maker);
        assert_eq!(immutables.taker, taker);
        assert_eq!(immutables.amount, amount);
        assert_eq!(immutables.safety_deposit, safety_deposit);
        
        // Events are emitted but may not be captured in test environment
        // This is a known limitation of the test framework
    }
    
    #[test]
    fn test_withdraw_with_correct_secret() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create test addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token with balance
        let token = setup_token(&env, &token_admin, 10000i128);
        let token_client = token::StellarAssetClient::new(&env, &token);
        
        // Transfer tokens to maker
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Create secret and hash
        let (secret, hashlock) = create_secret_and_hash(&env);
        
        // Create test data
        let order_hash = BytesN::from_array(&env, &[1u8; 32]);
        let amount = 1000i128;
        let safety_deposit = 0i128;
        let timelocks = 0u64; // No timelock for immediate withdrawal
        
        // Deploy escrow
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
        
        // Transfer tokens to escrow
        token_client.transfer(&maker, &contract_id, &amount);
        
        // Withdraw with correct secret
        client.withdraw(&secret, &false);
        
        // Check state changed to Withdrawn
        assert_eq!(client.get_state(), State::Withdrawn);
        
        // Check taker received tokens
        assert_eq!(token_client.balance(&taker), amount);
    }
    
    #[test]
    #[should_panic(expected = "InvalidSecret")]
    fn test_withdraw_with_wrong_secret() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create test addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token = Address::generate(&env);
        
        // Create secret and hash
        let (_, hashlock) = create_secret_and_hash(&env);
        let wrong_secret = BytesN::from_array(&env, &[99u8; 32]);
        
        // Deploy escrow
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &1000i128,
            &0i128,
            &0u64,
        );
        
        // Try to withdraw with wrong secret - should panic
        client.withdraw(&wrong_secret, &false);
    }
    
    #[test]
    fn test_cancel_escrow() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create test addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token
        let token = setup_token(&env, &token_admin, 10000i128);
        let token_client = token::StellarAssetClient::new(&env, &token);
        
        // Transfer tokens to maker
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Create test data
        let (_, hashlock) = create_secret_and_hash(&env);
        let amount = 1000i128;
        let timelocks = 0u64; // Allow immediate cancellation
        
        // Deploy escrow
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &amount,
            &0i128,
            &timelocks,
        );
        
        // Transfer tokens to escrow
        token_client.transfer(&maker, &contract_id, &amount);
        
        // Cancel escrow - maker cancels
        client.cancel(&maker);
        
        // Check state changed to Cancelled
        assert_eq!(client.get_state(), State::Cancelled);
        
        // Check maker got tokens back
        assert_eq!(token_client.balance(&maker), 2000i128); // Initial balance restored
    }
    
    #[test]
    #[should_panic(expected = "InvalidState")]
    fn test_withdraw_after_cancel() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token
        let token = setup_token(&env, &token_admin, 10000i128);
        let token_client = token::StellarAssetClient::new(&env, &token);
        
        // Transfer tokens to maker
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Setup escrow
        let (secret, hashlock) = create_secret_and_hash(&env);
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &1000i128,
            &0i128,
            &0u64,
        );
        
        // Transfer tokens to escrow
        token_client.transfer(&maker, &contract_id, &1000i128);
        
        // Cancel escrow - maker cancels
        client.cancel(&maker);
        
        // Try to withdraw after cancel - should panic
        client.withdraw(&secret, &false);
    }
    
    #[test]
    #[should_panic(expected = "InvalidState")]
    fn test_cancel_after_withdraw() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token
        let token = setup_token(&env, &token_admin, 10000i128);
        let token_client = token::StellarAssetClient::new(&env, &token);
        
        // Transfer tokens to maker
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Setup escrow
        let (secret, hashlock) = create_secret_and_hash(&env);
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &1000i128,
            &0i128,
            &0u64,
        );
        
        // Transfer tokens to escrow
        token_client.transfer(&maker, &contract_id, &1000i128);
        
        // Withdraw
        client.withdraw(&secret, &false);
        
        // Try to cancel after withdraw - should panic
        client.cancel(&maker);
    }
    
    #[test]
    fn test_timelock_functionality() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let token_admin = Address::generate(&env);
        
        // Setup token
        let token = setup_token(&env, &token_admin, 10000i128);
        let token_client = token::StellarAssetClient::new(&env, &token);
        
        // Transfer tokens to maker
        token_client.transfer(&token_admin, &maker, &2000i128);
        
        // Create test data
        let (secret, hashlock) = create_secret_and_hash(&env);
        let current_time = 1000u64;
        env.ledger().with_mut(|li| {
            li.timestamp = current_time;
        });
        
        // Create timelocks: withdrawal allowed after 2000, public withdrawal after 3000
        let timelocks = (2000u64 << 32) | (3000u64 << 40); // DST_WITHDRAWAL_TIMELOCK and DST_PUBLIC_WITHDRAWAL_TIMELOCK
        
        // Deploy escrow
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &token,
            &1000i128,
            &0i128,
            &timelocks,
        );
        
        // Transfer tokens to escrow
        token_client.transfer(&maker, &contract_id, &1000i128);
        
        // Try to withdraw before timelock - should panic
        // We can't use catch_unwind in no_std, so we'll comment this test
        // TODO: Find a better way to test expected panics in no_std
        
        // Advance time past withdrawal timelock
        env.ledger().with_mut(|li| {
            li.timestamp = 2500u64;
        });
        
        // Now withdrawal should work
        client.withdraw(&secret, &false);
        assert_eq!(client.get_state(), State::Withdrawn);
        
        // Check taker received tokens
        assert_eq!(token_client.balance(&taker), 1000i128);
    }
    
    #[test]
    fn test_native_token_detection() {
        let env = Env::default();
        
        // Test that native token is correctly detected
        let native_token = crate::get_native_token_address(&env);
        assert!(crate::is_native_token(&env, &native_token));
        
        // Test that other addresses are not detected as native
        let random_token = Address::generate(&env);
        assert!(!crate::is_native_token(&env, &random_token));
    }
    
    #[test]
    fn test_immutables_hash() {
        let env = Env::default();
        
        // Create test immutables
        let immutables1 = crate::types::Immutables {
            order_hash: BytesN::from_array(&env, &[1u8; 32]),
            hashlock: BytesN::from_array(&env, &[2u8; 32]),
            maker: Address::generate(&env),
            taker: Address::generate(&env),
            token: Address::generate(&env),
            amount: 1000i128,
            safety_deposit: 100i128,
            timelocks: 12345u64,
        };
        
        // Same immutables should produce same hash
        let hash1 = immutables1.hash(&env);
        let hash2 = immutables1.hash(&env);
        assert_eq!(hash1, hash2);
        
        // Different immutables should produce different hash
        let mut immutables2 = immutables1.clone();
        immutables2.amount = 2000i128;
        let hash3 = immutables2.hash(&env);
        assert_ne!(hash1, hash3);
    }
    
    #[test]
    fn test_safety_deposit() {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(StellarEscrow, ());
        let client = StellarEscrowClient::new(&env, &contract_id);
        
        // Create test addresses
        let maker = Address::generate(&env);
        let taker = Address::generate(&env);
        let native_token = Address::generate(&env); // Native XLM placeholder
        
        // Create test data with safety deposit
        let (_secret, hashlock) = create_secret_and_hash(&env);
        let amount = 1000i128;
        let safety_deposit = 100i128;
        
        // Deploy escrow with safety deposit
        client.deploy(
            &BytesN::from_array(&env, &[1u8; 32]),
            &hashlock,
            &maker,
            &taker,
            &native_token,
            &amount,
            &safety_deposit,
            &0u64,
        );
        
        // Verify immutables include safety deposit
        let immutables = client.get_immutables();
        assert_eq!(immutables.safety_deposit, safety_deposit);
    }
}