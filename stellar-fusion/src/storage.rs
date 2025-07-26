use soroban_sdk::Env;
use crate::types::{Immutables, State};

/// Storage keys
const IMMUTABLES_KEY: &str = "immutables";
const STATE_KEY: &str = "state";

/// Check if contract is initialized
pub fn is_initialized(env: &Env) -> bool {
    env.storage().persistent().has(&IMMUTABLES_KEY)
}

/// Set immutables in storage
pub fn set_immutables(env: &Env, immutables: &Immutables) {
    env.storage().persistent().set(&IMMUTABLES_KEY, immutables);
}

/// Get immutables from storage
pub fn get_immutables(env: &Env) -> Immutables {
    env.storage()
        .persistent()
        .get(&IMMUTABLES_KEY)
        .expect("Immutables not initialized")
}

/// Set state in storage
pub fn set_state(env: &Env, state: State) {
    env.storage().persistent().set(&STATE_KEY, &state);
}

/// Get state from storage
pub fn get_state(env: &Env) -> State {
    env.storage()
        .persistent()
        .get(&STATE_KEY)
        .unwrap_or(State::Active)
}