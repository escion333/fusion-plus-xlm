import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Circle, Clock, Loader2, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SwapProgressProps {
  status: 'creating' | 'pending' | 'processing' | 'completed' | 'failed';
  orderHash?: string;
  estimatedTime?: number; // in seconds
  error?: string;
  orderDetails?: {
    resolver?: string;
    escrowAddresses?: {
      source: string;
      destination: string;
    };
    txHashes?: {
      source: string;
      destination: string;
    };
  };
  onClose?: () => void;
}

const statusConfig = {
  creating: {
    title: 'Creating Order',
    description: 'Preparing your cross-chain swap...',
    icon: Loader2,
    color: 'text-brand-secondary',
  },
  pending: {
    title: 'Order Submitted',
    description: 'Waiting for resolver to claim...',
    icon: Clock,
    color: 'text-yellow-500',
  },
  processing: {
    title: 'Swap in Progress',
    description: 'Resolver is executing your swap...',
    icon: Loader2,
    color: 'text-brand-primary',
  },
  completed: {
    title: 'Swap Completed!',
    description: 'Your tokens have been transferred.',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  failed: {
    title: 'Swap Failed',
    description: 'Something went wrong with your swap.',
    icon: XCircle,
    color: 'text-red-500',
  },
};

const steps = [
  { id: 'create', label: 'Create Order' },
  { id: 'claim', label: 'Resolver Claims' },
  { id: 'escrow', label: 'Deploy Escrows' },
  { id: 'execute', label: 'Execute Swap' },
  { id: 'complete', label: 'Complete' },
];

export function SwapProgress({ status, orderHash, estimatedTime = 120, error, orderDetails, onClose }: SwapProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState(estimatedTime);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (status === 'creating') setCurrentStep(0);
    else if (status === 'pending') setCurrentStep(1);
    else if (status === 'processing') setCurrentStep(2);
    else if (status === 'completed') setCurrentStep(4);
    else if (status === 'failed') setCurrentStep(-1);
  }, [status]);

  useEffect(() => {
    if (status === 'processing' || status === 'pending') {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Card className="w-full relative bg-neutral-900/80 backdrop-blur-sm border-0">
      <CardContent className="p-6">
        {/* Close button */}
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2"
            onClick={onClose}
            title={status === 'completed' || status === 'failed' ? 'Close' : 'Cancel'}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        
        {/* Status Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Icon 
              className={`w-6 h-6 ${config.color} ${
                status === 'creating' || status === 'processing' ? 'animate-spin' : ''
              }`} 
            />
            <div>
              <h3 className="font-medium text-lg text-neutral-0">{config.title}</h3>
              <p className="text-sm text-neutral-300">{config.description}</p>
            </div>
          </div>
          {(status === 'pending' || status === 'processing') && (
            <div className="text-right">
              <div className="text-2xl font-mono font-medium text-neutral-0">{formatTime(timeRemaining)}</div>
              <div className="text-xs text-neutral-400">estimated time</div>
            </div>
          )}
        </div>

        {/* Progress Steps */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div className="relative">
                  {index < currentStep ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : index === currentStep ? (
                    <div className="relative">
                      <Circle className="w-6 h-6 text-brand-primary" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-brand-primary rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <Circle className="w-6 h-6 text-neutral-500" />
                  )}
                  {index < steps.length - 1 && (
                    <div
                      className={`absolute left-6 top-3 h-0.5 w-full ${
                        index < currentStep ? 'bg-green-500' : 'bg-neutral-500'
                      }`}
                      style={{ width: 'calc(100% + 24px)' }}
                    />
                  )}
                </div>
                <span className={`text-xs mt-1 ${
                  index <= currentStep ? 'text-neutral-0' : 'text-neutral-400'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Order Details */}
        {orderHash && (
          <div className="bg-neutral-800/50 rounded-lg p-3 mb-4 space-y-2">
            <div>
              <div className="text-xs text-neutral-400 mb-1">Order Hash</div>
              <div className="font-mono text-xs break-all text-neutral-200">{orderHash}</div>
            </div>
            
            {orderDetails?.resolver && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Resolver</div>
                <div className="font-mono text-xs text-neutral-200">{orderDetails.resolver.slice(0, 10)}...{orderDetails.resolver.slice(-8)}</div>
              </div>
            )}
            
            {orderDetails?.escrowAddresses && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Escrow Contracts</div>
                <div className="text-xs space-y-1">
                  <div>Source: {orderDetails.escrowAddresses.source.slice(0, 10)}...{orderDetails.escrowAddresses.source.slice(-8)}</div>
                  <div>Dest: {orderDetails.escrowAddresses.destination.slice(0, 10)}...{orderDetails.escrowAddresses.destination.slice(-8)}</div>
                </div>
              </div>
            )}
            
            {orderDetails?.txHashes && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Transaction Hashes</div>
                <div className="text-xs space-y-1">
                  <div>Source: {orderDetails.txHashes.source.slice(0, 10)}...{orderDetails.txHashes.source.slice(-8)}</div>
                  <div>Dest: {orderDetails.txHashes.destination.slice(0, 10)}...{orderDetails.txHashes.destination.slice(-8)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && status === 'failed' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Helpful Tips */}
        {status === 'pending' && (
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-3">
            <div className="text-sm text-brand-primary">
              💡 Your order is waiting for a resolver to claim it. This typically takes 10-30 seconds.
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-3">
            <div className="text-sm text-brand-primary">
              🔄 Your swap is being executed across both chains. Do not close this window.
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
            <div className="text-sm text-green-400">
              ✅ Success! Your tokens have been transferred. Check your destination wallet.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}