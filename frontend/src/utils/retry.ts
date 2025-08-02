interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error & { status?: number }) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error: Error & { status?: number }) => {
    // Retry on network errors or 5xx server errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return true;
    }
    if (error.status && error.status >= 500 && error.status < 600) {
      return true;
    }
    // Retry on specific rate limit errors with longer delay
    if (error.status === 429) {
      return true;
    }
    return false;
  }
};

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error = new Error('No attempts made');
  
  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if we should retry
      if (!opts.shouldRetry(lastError) || attempt === opts.maxAttempts - 1) {
        throw lastError;
      }
      
      // Calculate delay with exponential backoff
      const delay = opts.delayMs * Math.pow(opts.backoffMultiplier, attempt);
      
      // Add extra delay for rate limit errors
      const finalDelay = (lastError as Error & { status?: number }).status === 429 ? delay * 2 : delay;
      
      console.log(`Retry attempt ${attempt + 1}/${opts.maxAttempts} after ${finalDelay}ms delay`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  throw lastError;
}

// Specific retry wrapper for quote fetching
export async function retryQuoteFetch<T>(
  fn: () => Promise<T>
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 3,
    delayMs: 500,
    shouldRetry: (error: Error & { status?: number }) => {
      // Don't retry on client errors (4xx) except rate limits
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        return false;
      }
      return DEFAULT_OPTIONS.shouldRetry(error);
    }
  });
}

// Specific retry wrapper for order status polling
export async function retryOrderStatus<T>(
  fn: () => Promise<T>
): Promise<T> {
  return retryWithBackoff(fn, {
    maxAttempts: 5,
    delayMs: 1000,
    shouldRetry: (error: Error & { status?: number }) => {
      // Always retry order status checks except for 404 (order not found)
      if (error.status && error.status === 404) {
        return false;
      }
      return true;
    }
  });
}