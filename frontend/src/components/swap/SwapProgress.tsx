import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, XCircle, X, ExternalLink } from 'lucide-react';
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
      source?: string;
      destination?: string;
      sourceDeployment?: string;
      destinationDeployment?: string;
      sourceWithdrawal?: string;
      destinationWithdrawal?: string;
    };
  };
  onClose?: () => void;
  isMockMode?: boolean;
}

const statusConfig = {
  creating: {
    title: 'Creating Order',
    description: 'Submitting your swap request to the network...',
    icon: Loader2,
    color: 'text-brand-secondary',
  },
  pending: {
    title: 'Escrows Deploying',
    description: 'Resolver is creating secure escrow contracts on both chains...',
    icon: Clock,
    color: 'text-yellow-500',
  },
  processing: {
    title: 'Executing Swap',
    description: 'Transferring tokens between chains via HTLC...',
    icon: Loader2,
    color: 'text-brand-primary',
  },
  completed: {
    title: 'Swap Completed!',
    description: 'Your tokens have been successfully transferred.',
    icon: CheckCircle2,
    color: 'text-green-500',
  },
  failed: {
    title: 'Swap Failed',
    description: 'The swap could not be completed. Funds are safe.',
    icon: XCircle,
    color: 'text-red-500',
  },
};

const steps = [
  { id: 'create', label: 'Create' },
  { id: 'escrow', label: 'Escrows' },
  { id: 'user-claim', label: 'You Claim' },
  { id: 'resolver-claim', label: 'Resolver' },
  { id: 'complete', label: 'Done' },
];

export function SwapProgress({ status, orderHash, estimatedTime = 120, error, orderDetails, onClose, isMockMode = false }: SwapProgressProps) {
  const [timeRemaining, setTimeRemaining] = useState(estimatedTime);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (status === 'creating') setCurrentStep(0);      // Creating order
    else if (status === 'pending') setCurrentStep(1);   // Waiting for resolver to deploy escrows
    else if (status === 'processing') setCurrentStep(2); // Escrows deployed, executing swap
    else if (status === 'completed') setCurrentStep(4);  // All done
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

  // Assume realTxData from useSwap hook
  const explorerLinks = {
    ethereum: (hash) => `https://etherscan.io/tx/${hash}`,
    stellar: (hash) => `https://stellar.expert/explorer/public/tx/${hash}`,
  };

  // In render: Use realTxData.hash with explorerLinks[fromChain](realTxData.hash)

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
        <div className="flex items-center justify-between mb-6 pr-10">
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
          <div className="flex justify-between mb-2 relative px-2">
            {steps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1 relative z-10 min-w-0">
                <div className="relative">
                  {index < currentStep ? (
                    <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-neutral-200" />
                    </div>
                  ) : index === currentStep ? (
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-600 flex items-center justify-center">
                        <div className="w-3 h-3 bg-neutral-400 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                      <div className="w-2 h-2 bg-neutral-600 rounded-full" />
                    </div>
                  )}
                </div>
                <span className={`text-xs mt-2 text-center whitespace-nowrap ${
                  index <= currentStep ? 'text-neutral-200' : 'text-neutral-500'
                }`}>
                  {step.label}
                </span>
              </div>
            ))}
            {/* Progress line */}
            <div className="absolute top-4 left-0 right-0 h-[1px] bg-neutral-700" style={{ width: 'calc(100% - 32px)', marginLeft: '16px' }}>
              <div 
                className="h-full bg-neutral-500 transition-all duration-500"
                style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
              />
            </div>
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
                <div className="text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Ethereum:</span>
                    <a
                      href={`https://etherscan.io/address/${orderDetails.escrowAddresses.source}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="font-mono">{orderDetails.escrowAddresses.source.slice(0, 10)}...{orderDetails.escrowAddresses.source.slice(-8)}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Stellar:</span>
                    <div className="flex items-center gap-2">
                      {orderDetails.escrowAddresses.destination === 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU' && (
                        <span className="text-xs bg-neutral-700/50 text-neutral-300 px-2 py-0.5 rounded">MAINNET</span>
                      )}
                      <a
                        href={`https://stellar.expert/explorer/public/contract/${orderDetails.escrowAddresses.destination}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                      >
                        <span className="font-mono">{orderDetails.escrowAddresses.destination.slice(0, 10)}...{orderDetails.escrowAddresses.destination.slice(-8)}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {orderDetails?.txHashes && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Transaction Verification</div>
                <div className="text-xs space-y-2">
                  {orderDetails.txHashes.sourceDeployment && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">Ethereum Escrow:</span>
                      <a
                        href={`https://etherscan.io/tx/${orderDetails.txHashes.sourceDeployment}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                      >
                        <span className="font-mono">{orderDetails.txHashes.sourceDeployment.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {orderDetails.txHashes.destinationDeployment && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">Stellar Escrow:</span>
                      <a
                        href={`https://stellar.expert/explorer/public/tx/${orderDetails.txHashes.destinationDeployment}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                      >
                        <span className="font-mono">{orderDetails.txHashes.destinationDeployment.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {orderDetails.txHashes.sourceWithdrawal && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">ETH Withdrawal:</span>
                      <a
                        href={`https://etherscan.io/tx/${orderDetails.txHashes.sourceWithdrawal}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                      >
                        <span className="font-mono">{orderDetails.txHashes.sourceWithdrawal.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {orderDetails.txHashes.destinationWithdrawal && (
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300">XLM Withdrawal:</span>
                      <a
                        href={`https://stellar.expert/explorer/public/tx/${orderDetails.txHashes.destinationWithdrawal}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                      >
                        <span className="font-mono">{orderDetails.txHashes.destinationWithdrawal.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && status === 'failed' && (
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        )}

        {/* Helpful Tips */}
        {status === 'pending' && (
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="text-sm text-neutral-300">
              A resolver has accepted your order and is deploying secure escrow contracts on both Ethereum and Stellar. This ensures atomic execution of your swap.
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="text-sm text-neutral-300">
              The HTLC (Hash Time-Locked Contract) swap is executing. You'll receive tokens on the destination chain once you reveal the secret. Do not close this window.
            </div>
          </div>
        )}

        {status === 'completed' && (
          <>
            <div className="bg-neutral-800/50 rounded-lg p-3 mb-3">
              <div className="text-sm text-neutral-200">
                <span className="text-green-500">Success!</span> Your tokens have been transferred. Check your destination wallet.
              </div>
            </div>
            {isMockMode && (
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">Demo Note:</span> The Stellar contract is deployed on mainnet and verifiable. 
                  Ethereum transactions are simulated for demo safety. In production, both chains would have real transactions.
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}