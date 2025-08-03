import { QuoteParams, SwapParams, ETHEREUM_ADDRESS_REGEX, AMOUNT_REGEX } from './types.ts';

export class ValidationError extends Error {
  constructor(public field: string, public reason: string) {
    super(`Validation failed for ${field}: ${reason}`);
    this.name = 'ValidationError';
  }
}

export function validateAddress(address: string, fieldName: string): void {
  if (!address) {
    throw new ValidationError(fieldName, 'Address is required');
  }
  
  // Check for special native token addresses
  const nativeAddresses = [
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    '0x0000000000000000000000000000000000000000'
  ];
  
  if (nativeAddresses.includes(address)) {
    return;
  }
  
  if (!ETHEREUM_ADDRESS_REGEX.test(address)) {
    throw new ValidationError(fieldName, 'Invalid Ethereum address format');
  }
}

export function validateAmount(amount: string): void {
  if (!amount) {
    throw new ValidationError('amount', 'Amount is required');
  }
  
  if (!AMOUNT_REGEX.test(amount)) {
    throw new ValidationError('amount', 'Amount must be a positive integer');
  }
  
  const bigIntAmount = BigInt(amount);
  if (bigIntAmount <= 0n) {
    throw new ValidationError('amount', 'Amount must be greater than 0');
  }
  
  // Max safe amount check (prevent overflow)
  const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
  if (bigIntAmount > MAX_UINT256) {
    throw new ValidationError('amount', 'Amount exceeds maximum value');
  }
}

export function validateSlippage(slippage?: string): void {
  if (!slippage) return;
  
  const slippageNum = parseFloat(slippage);
  if (isNaN(slippageNum) || slippageNum < 0 || slippageNum > 50) {
    throw new ValidationError('slippage', 'Slippage must be between 0 and 50');
  }
}

export function validateQuoteParams(params: Partial<QuoteParams>): QuoteParams {
  // Required fields
  if (!params.src) throw new ValidationError('src', 'Source token is required');
  if (!params.dst) throw new ValidationError('dst', 'Destination token is required');
  if (!params.amount) throw new ValidationError('amount', 'Amount is required');
  
  // Validate addresses
  validateAddress(params.src, 'src');
  validateAddress(params.dst, 'dst');
  
  // Validate amount
  validateAmount(params.amount);
  
  // Validate optional fields
  if (params.from) validateAddress(params.from, 'from');
  validateSlippage(params.slippage);
  
  // Validate protocols if provided
  if (params.protocols) {
    const validProtocols = [
      'UNISWAP_V2', 'UNISWAP_V3', 'SUSHI', 'CURVE', 'BALANCER',
      'ONEINCH_FUSION', 'PMM', 'STABLE', 'CURVE_V2'
    ];
    const protocols = params.protocols.split(',');
    for (const protocol of protocols) {
      if (!validProtocols.includes(protocol.trim())) {
        throw new ValidationError('protocols', `Invalid protocol: ${protocol}`);
      }
    }
  }
  
  return params as QuoteParams;
}

export function validateSwapParams(params: Partial<SwapParams>): SwapParams {
  // First validate as quote params
  const validQuoteParams = validateQuoteParams(params);
  
  // Additional swap-specific validations
  if (params.receiver) validateAddress(params.receiver, 'receiver');
  if (params.referrer) validateAddress(params.referrer, 'referrer');
  
  return { ...validQuoteParams, ...params } as SwapParams;
}

// Sanitize input to prevent injection
export function sanitizeInput(input: string): string {
  // Remove any non-alphanumeric characters except common safe ones
  return input.replace(/[^a-zA-Z0-9\-_.,]/g, '');
}

// Build safe URL with validated params
export function buildSafeUrl(baseUrl: string, params: URLSearchParams): string {
  const url = new URL(baseUrl);
  
  // Only add whitelisted params
  const allowedParams = [
    'src', 'dst', 'amount', 'from', 'slippage', 'protocols', 
    'fee', 'gasPrice', 'complexityLevel', 'connectorTokens',
    'gasLimit', 'mainRouteParts', 'parts', 'includeProtocols',
    'includeTokensInfo', 'includeGas', 'receiver', 'referrer',
    'disableEstimate', 'permit', 'allowPartialFill', 'usePermit2'
  ];
  
  for (const [key, value] of params.entries()) {
    if (allowedParams.includes(key)) {
      url.searchParams.append(key, value);
    }
  }
  
  return url.toString();
}