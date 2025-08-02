'use client';

import React from 'react';
import { AlertCircle, RefreshCw, Terminal, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  isMockMode?: boolean;
}

export function ErrorDisplay({ error, onRetry, isMockMode = false }: ErrorDisplayProps) {
  // Parse error to determine type and provide specific help
  const getErrorInfo = () => {
    if (error.includes('Cannot connect') || error.includes('Network error')) {
      return {
        title: 'Connection Failed',
        icon: Server,
        steps: [
          'Ensure all required services are running:',
          '• Frontend: npm run dev (port 3000)',
          '• Resolver Service: npm run resolver (port 3001)',
          '• API Proxy: npm run proxy (port 3002)',
          '',
          'Check that no other processes are using these ports.'
        ],
        canRetry: true,
      };
    }
    
    if (error.includes('Rate limit')) {
      return {
        title: 'Rate Limit Exceeded',
        icon: AlertCircle,
        steps: [
          'Too many requests have been made.',
          'Please wait a moment before trying again.',
          'This helps protect the service from overload.'
        ],
        canRetry: true,
      };
    }
    
    if (error.includes('Invalid token pair') || error.includes('Invalid quote parameters')) {
      return {
        title: 'Invalid Token Selection',
        icon: AlertCircle,
        steps: [
          'The selected token pair may not be supported.',
          'Try a different combination or check:',
          '• Token amounts are valid',
          '• Tokens are available on selected chains',
          '• You have sufficient balance'
        ],
        canRetry: false,
      };
    }
    
    if (error.includes('MetaMask must be connected') || error.includes('Authentication failed')) {
      return {
        title: 'Wallet Connection Required',
        icon: AlertCircle,
        steps: [
          'Please connect your wallet to continue.',
          'Make sure you have:',
          '• MetaMask installed and unlocked',
          '• Connected to the correct network',
          '• Approved the connection request'
        ],
        canRetry: false,
      };
    }
    
    if (error.includes('Service unavailable') || error.includes('Server error')) {
      return {
        title: 'Service Temporarily Unavailable',
        icon: Server,
        steps: [
          'The service is experiencing issues.',
          'This could be due to:',
          '• High traffic or maintenance',
          '• Backend service restart needed',
          '• Network connectivity problems',
          '',
          'Try again in a few moments.'
        ],
        canRetry: true,
      };
    }
    
    // Default error
    return {
      title: 'Error',
      icon: AlertCircle,
      steps: [error],
      canRetry: true,
    };
  };
  
  const errorInfo = getErrorInfo();
  const Icon = errorInfo.icon;
  
  return (
    <div className="text-red-400 text-sm p-4 border border-red-500/20 rounded-xl bg-red-500/10">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="font-medium text-red-300">{errorInfo.title}</div>
          <div className="text-xs text-red-400/80 space-y-1">
            {errorInfo.steps.map((step, index) => (
              <div key={index} className={step.startsWith('•') ? 'ml-4' : ''}>
                {step || <br />}
              </div>
            ))}
          </div>
          
          {!isMockMode && error.includes('Failed') && (
            <div className="mt-3 p-2 bg-red-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-xs text-red-300">
                <Terminal className="w-4 h-4" />
                <span>Quick Start Commands:</span>
              </div>
              <pre className="mt-1 text-xs text-red-400/70 font-mono">
                npm run dev      # Frontend
                npm run resolver # Resolver Service  
                npm run proxy    # API Proxy
              </pre>
            </div>
          )}
          
          {onRetry && errorInfo.canRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-3 text-red-300 hover:text-red-200 hover:bg-red-500/20"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}