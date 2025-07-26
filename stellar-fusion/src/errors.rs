use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    InvalidState = 1,
    InvalidSecret = 2,
    TimelockNotExpired = 3,
    CannotCancel = 4,
    InvalidAmount = 5,
    InvalidAddress = 6,
    AlreadyInitialized = 7,
    NotInitialized = 8,
    InsufficientBalance = 9,
    UnauthorizedCaller = 10,
}

#[macro_export]
macro_rules! panic_with_error {
    ($env:expr, $error:expr) => {
        panic!("{:?}", $error)
    };
}