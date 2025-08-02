'use client';

import React from 'react';
import { Circle, RefreshCw } from 'lucide-react';
import { useServiceHealth } from '@/hooks/useServiceHealth';
import { Button } from '@/components/ui/button';

export function ServiceStatus() {
  const { health, isChecking, refresh } = useServiceHealth(30000); // Check every 30 seconds
  
  if (!health) {
    return null;
  }
  
  const getStatusColor = (status: 'healthy' | 'unhealthy' | 'checking') => {
    switch (status) {
      case 'healthy':
        return 'text-green-400';
      case 'unhealthy':
        return 'text-red-400';
      case 'checking':
        return 'text-yellow-400';
    }
  };
  
  const getStatusText = (status: 'healthy' | 'unhealthy' | 'checking') => {
    switch (status) {
      case 'healthy':
        return 'Connected';
      case 'unhealthy':
        return 'Disconnected';
      case 'checking':
        return 'Checking...';
    }
  };
  
  return (
    <div className="fixed bottom-4 right-4 bg-neutral-900/90 backdrop-blur-sm border border-neutral-700 rounded-lg p-4 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-4">
        <span className="font-medium text-neutral-200">Service Status</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isChecking}
          className="h-6 px-2 text-neutral-400 hover:text-neutral-200"
        >
          <RefreshCw className={`h-3 w-3 ${isChecking ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-400">Resolver Service</span>
          <div className={`flex items-center gap-1 ${getStatusColor(health.resolver.status)}`}>
            <Circle className="h-2 w-2 fill-current" />
            <span>{getStatusText(health.resolver.status)}</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-4">
          <span className="text-neutral-400">API Proxy</span>
          <div className={`flex items-center gap-1 ${getStatusColor(health.proxy.status)}`}>
            <Circle className="h-2 w-2 fill-current" />
            <span>{getStatusText(health.proxy.status)}</span>
          </div>
        </div>
      </div>
      
      {(health.resolver.status === 'unhealthy' || health.proxy.status === 'unhealthy') && (
        <div className="pt-2 border-t border-neutral-700">
          <div className="text-xs text-red-400">
            {health.resolver.status === 'unhealthy' && (
              <div>• Resolver: {health.resolver.error}</div>
            )}
            {health.proxy.status === 'unhealthy' && (
              <div>• Proxy: {health.proxy.error}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}