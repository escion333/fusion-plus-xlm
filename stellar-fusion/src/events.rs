use soroban_sdk::{Address, BytesN, Env, symbol_short};

/// Emit when escrow is created
pub fn emit_escrow_created(env: &Env, order_hash: &BytesN<32>, maker: &Address, taker: &Address) {
    // Create a tuple of the event data
    let event_data = (order_hash.clone(), maker.clone(), taker.clone());
    
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("created")),
        event_data,
    );
}

/// Emit when secret is revealed
pub fn emit_secret_revealed(env: &Env, secret: &BytesN<32>) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("withdraw")),
        secret.clone(),
    );
}

/// Emit when escrow is cancelled
pub fn emit_escrow_cancelled(env: &Env) {
    env.events().publish(
        (symbol_short!("escrow"), symbol_short!("cancel")),
        (),
    );
}