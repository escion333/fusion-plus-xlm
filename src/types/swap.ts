export interface SwapOrder {
  id: string;
  orderHash: string;
  maker: string;
  taker: string;
  makerAsset: string;
  takerAsset: string;
  makerAmount: string;
  takerAmount: string;
  sourceChain: string;
  destinationChain: string;
  hashlock: string;
  secret?: string;
  timelocks: {
    srcWithdrawal: number;
    srcPublicWithdrawal: number;
    srcCancellation: number;
    srcPublicCancellation: number;
    dstWithdrawal: number;
    dstPublicWithdrawal: number;
    dstCancellation: number;
  };
  status: SwapStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum SwapStatus {
  CREATED = 'CREATED',
  SOURCE_FUNDED = 'SOURCE_FUNDED',
  DESTINATION_DEPLOYED = 'DESTINATION_DEPLOYED',
  DESTINATION_FUNDED = 'DESTINATION_FUNDED',
  SECRET_REVEALED = 'SECRET_REVEALED',
  SOURCE_WITHDRAWN = 'SOURCE_WITHDRAWN',
  DESTINATION_WITHDRAWN = 'DESTINATION_WITHDRAWN',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export interface EscrowEvent {
  type: 'EscrowCreated' | 'SecretRevealed' | 'EscrowCancelled' | 'EscrowWithdrawn';
  chain: string;
  escrowAddress: string;
  orderHash: string;
  timestamp: number;
  blockNumber: number;
  transactionHash: string;
  data: any;
}

export interface EscrowImmutables {
  orderHash: string;
  hashlock: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: bigint;
}