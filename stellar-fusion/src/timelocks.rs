use soroban_sdk::{Address, Env};
use crate::types::*;

/// Extract a specific timelock value from the bit-packed timelocks
pub fn get_timelock(timelocks: u64, index: u8) -> u32 {
    // Each timelock is 32 bits, extract the specific one
    ((timelocks >> (index * 8)) & 0xFF) as u32
}

/// Check if withdrawal is allowed based on timelocks
pub fn can_withdraw(env: &Env, timelocks: &u64, is_public: bool) -> bool {
    let current_time = env.ledger().timestamp();
    
    if is_public {
        // For public withdrawal, check DST_PUBLIC_WITHDRAWAL_TIMELOCK
        let public_timelock = get_timelock(*timelocks, DST_PUBLIC_WITHDRAWAL_TIMELOCK);
        current_time >= public_timelock as u64
    } else {
        // For regular withdrawal, check DST_WITHDRAWAL_TIMELOCK
        let withdrawal_timelock = get_timelock(*timelocks, DST_WITHDRAWAL_TIMELOCK);
        current_time >= withdrawal_timelock as u64
    }
}

/// Check if cancellation is allowed based on timelocks and caller
pub fn can_cancel(
    env: &Env,
    timelocks: &u64,
    caller: &Address,
    maker: &Address,
    taker: &Address,
) -> bool {
    let current_time = env.ledger().timestamp();
    
    // Check if it's public cancellation time
    let public_cancel_timelock = get_timelock(*timelocks, DST_CANCELLATION_TIMELOCK);
    if current_time >= public_cancel_timelock as u64 {
        return true; // Anyone can cancel
    }
    
    // Check if it's regular cancellation time and caller is authorized
    let cancel_timelock = get_timelock(*timelocks, SRC_CANCELLATION_TIMELOCK);
    if current_time >= cancel_timelock as u64 {
        return caller == maker || caller == taker;
    }
    
    false
}

/// Pack individual timelocks into a single u64
#[allow(dead_code)]
pub fn pack_timelocks(timelocks: [u32; 7]) -> u64 {
    let mut packed: u64 = 0;
    for (i, &timelock) in timelocks.iter().enumerate() {
        packed |= (timelock as u64) << (i * 8);
    }
    packed
}