// Placeholder ABIs for 1inch Fusion+ contracts
// These should be replaced with actual ABIs from the deployed contracts

export const ESCROW_FACTORY_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "orderHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "hashlock", "type": "bytes32" },
      { "internalType": "address", "name": "maker", "type": "address" },
      { "internalType": "address", "name": "taker", "type": "address" },
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "safetyDeposit", "type": "uint256" },
      { "internalType": "uint256", "name": "timelocks", "type": "uint256" }
    ],
    "name": "deploy",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "escrow", "type": "address" },
      { "indexed": true, "internalType": "bytes32", "name": "orderHash", "type": "bytes32" }
    ],
    "name": "EscrowCreated",
    "type": "event"
  }
];

export const ESCROW_ABI = [
  {
    "inputs": [],
    "name": "immutables",
    "outputs": [
      {
        "components": [
          { "internalType": "bytes32", "name": "orderHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "hashlock", "type": "bytes32" },
          { "internalType": "address", "name": "maker", "type": "address" },
          { "internalType": "address", "name": "taker", "type": "address" },
          { "internalType": "address", "name": "token", "type": "address" },
          { "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "internalType": "uint256", "name": "safetyDeposit", "type": "uint256" },
          { "internalType": "uint256", "name": "timelocks", "type": "uint256" }
        ],
        "internalType": "struct Immutables",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "state",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bytes32", "name": "secret", "type": "bytes32" },
      { "internalType": "bool", "name": "unwrapNative", "type": "bool" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "cancel",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "orderHash", "type": "bytes32" },
      { "indexed": false, "internalType": "bytes32", "name": "secret", "type": "bytes32" }
    ],
    "name": "SecretRevealed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "orderHash", "type": "bytes32" }
    ],
    "name": "EscrowCancelled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "bytes32", "name": "orderHash", "type": "bytes32" },
      { "indexed": true, "internalType": "address", "name": "recipient", "type": "address" }
    ],
    "name": "EscrowWithdrawn",
    "type": "event"
  }
];