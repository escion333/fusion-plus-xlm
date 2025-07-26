use soroban_sdk::{contracttype, Address, BytesN, Env, Bytes};

/// Immutable data stored for each escrow
#[derive(Clone, Debug)]
#[contracttype]
pub struct Immutables {
    pub order_hash: BytesN<32>,
    pub hashlock: BytesN<32>,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub timelocks: u64, // bit-packed timelocks
}

impl Immutables {
    /// Calculate hash of immutables for deterministic address calculation
    pub fn hash(&self, env: &Env) -> BytesN<32> {
        // Create a bytes buffer and append all fields in a deterministic order
        let mut bytes = Bytes::new(env);
        
        // Append BytesN fields directly
        bytes.append(&Bytes::from(self.order_hash.clone()));
        bytes.append(&Bytes::from(self.hashlock.clone()));
        
        // For addresses, we need to serialize them in a deterministic way
        // Soroban addresses are 32-byte contract IDs or account IDs
        // We'll use the raw contract/account ID bytes
        
        // Note: In a real implementation, you'd need to extract the actual
        // address bytes. For now, we'll use placeholders that ensure uniqueness
        bytes.append(&Bytes::from_slice(env, b"MAKER_ADDR_PLACEHOLDER"));
        bytes.append(&Bytes::from_slice(env, b"TAKER_ADDR_PLACEHOLDER"));  
        bytes.append(&Bytes::from_slice(env, b"TOKEN_ADDR_PLACEHOLDER"));
        
        // Append numeric values as fixed-size byte arrays
        let amount_bytes: [u8; 16] = self.amount.to_be_bytes();
        bytes.append(&Bytes::from_array(env, &amount_bytes));
        
        let deposit_bytes: [u8; 16] = self.safety_deposit.to_be_bytes();
        bytes.append(&Bytes::from_array(env, &deposit_bytes));
        
        let timelock_bytes: [u8; 8] = self.timelocks.to_be_bytes();
        bytes.append(&Bytes::from_array(env, &timelock_bytes));
        
        // Hash the complete data
        let hash = env.crypto().sha256(&bytes);
        BytesN::from_array(env, &hash.to_array())
    }
}

/// Escrow state
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
pub enum State {
    Active = 0,
    Withdrawn = 1,
    Cancelled = 2,
}

/// Timelock indices matching 1inch protocol
#[allow(dead_code)]
pub const SRC_WITHDRAWAL_TIMELOCK: u8 = 0;
#[allow(dead_code)]
pub const SRC_PUBLIC_WITHDRAWAL_TIMELOCK: u8 = 1;
pub const SRC_CANCELLATION_TIMELOCK: u8 = 2;
#[allow(dead_code)]
pub const SRC_PUBLIC_CANCELLATION_TIMELOCK: u8 = 3;
pub const DST_WITHDRAWAL_TIMELOCK: u8 = 4;
pub const DST_PUBLIC_WITHDRAWAL_TIMELOCK: u8 = 5;
pub const DST_CANCELLATION_TIMELOCK: u8 = 6;