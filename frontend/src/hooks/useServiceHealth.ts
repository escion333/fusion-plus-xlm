'use client';

import { useEffect, useState } from 'react';
import { checkServicesHealth, HealthCheckResult } from '@/utils/healthCheck';

export function useServiceHealth(checkInterval = 30000) { // Check every 30 seconds
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const performHealthCheck = async () => {
    setIsChecking(true);
    try {
      const result = await checkServicesHealth();
      setHealth(result);
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check
    performHealthCheck();

    // Set up interval
    const interval = setInterval(performHealthCheck, checkInterval);

    return () => clearInterval(interval);
  }, [checkInterval]);

  return { health, isChecking, refresh: performHealthCheck };
}