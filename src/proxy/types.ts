import { Request, Response } from 'express';

// Request parameter interfaces
export interface QuoteParams {
  src: string;
  dst: string;
  amount: string;
  from?: string;
  slippage?: string;
  protocols?: string;
  fee?: string;
  gasPrice?: string;
  complexityLevel?: string;
  connectorTokens?: string;
  gasLimit?: string;
  mainRouteParts?: string;
  parts?: string;
  includeProtocols?: string;
  includeTokensInfo?: boolean;
  includeGas?: boolean;
}

export interface SwapParams extends QuoteParams {
  receiver?: string;
  referrer?: string;
  disableEstimate?: boolean;
  permit?: string;
  allowPartialFill?: boolean;
  usePermit2?: boolean;
}

// Typed request interfaces
export interface TypedRequest<T = any> extends Request {
  query: T;
  body: T;
}

export interface QuoteRequest extends TypedRequest<QuoteParams> {}
export interface SwapRequest extends TypedRequest<SwapParams> {}

// Response interfaces
export interface ApiError {
  error: string;
  statusCode: number;
  description?: string;
}

export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  logoURI?: string;
}

export interface QuoteResponse {
  fromToken: TokenInfo;
  toToken: TokenInfo;
  fromAmount: string;
  toAmount: string;
  protocols: Array<Array<{ name: string; part: number }>>;
  estimatedGas: string;
  gasPrice?: string;
}

export interface OrderResponse {
  success: boolean;
  order: {
    orderHash: string;
    status: string;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    toAmount: string;
    createdAt: string;
  };
}

// Validation schemas
export const SUPPORTED_CHAINS = {
  1: 'ethereum',
  137: 'polygon',
  56: 'bsc',
  42161: 'arbitrum',
  10: 'optimism',
  43114: 'avalanche',
} as const;

export const ETHEREUM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
export const AMOUNT_REGEX = /^\d+$/;