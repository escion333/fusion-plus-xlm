export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'checking';
  lastChecked?: Date;
  error?: string;
}

export interface HealthCheckResult {
  resolver: ServiceHealth;
  proxy: ServiceHealth;
  overall: boolean;
}

const RESOLVER_URL = process.env.NEXT_PUBLIC_RESOLVER_API_URL || 'http://localhost:3001';
const PROXY_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

async function checkService(url: string, endpoint: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${url}${endpoint}`, {
      signal: controller.signal,
      method: 'GET',
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkServicesHealth(): Promise<HealthCheckResult> {
  const results: HealthCheckResult = {
    resolver: {
      name: 'Resolver Service',
      url: RESOLVER_URL,
      status: 'checking'
    },
    proxy: {
      name: 'API Proxy',
      url: PROXY_URL,
      status: 'checking'
    },
    overall: false
  };

  // Check resolver service
  const resolverHealthy = await checkService(RESOLVER_URL, '/health');
  results.resolver.status = resolverHealthy ? 'healthy' : 'unhealthy';
  results.resolver.lastChecked = new Date();
  if (!resolverHealthy) {
    results.resolver.error = `Cannot connect to Resolver Service at ${RESOLVER_URL}`;
  }

  // Check proxy service - try a simple endpoint
  const proxyHealthy = await checkService(PROXY_URL, '/api/fusion/orders/active');
  results.proxy.status = proxyHealthy ? 'healthy' : 'unhealthy';
  results.proxy.lastChecked = new Date();
  if (!proxyHealthy) {
    results.proxy.error = `Cannot connect to API Proxy at ${PROXY_URL}`;
  }

  results.overall = resolverHealthy && proxyHealthy;
  return results;
}