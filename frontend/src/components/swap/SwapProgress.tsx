import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Clock, Loader2, XCircle, X, ExternalLink, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface PartialFill {
  index: number;
  amount: string;
  percentage: number;
  txHash?: string;
  status: 'pending' | 'completed';
  timestamp?: number;
}

interface SwapProgressProps {
  status: 'creating' | 'pending' | 'processing' | 'completed' | 'failed';
  orderHash?: string;
  estimatedTime?: number; // in seconds
  error?: string;
  orderDetails?: {
    resolver?: string;
    secret?: string; // Add secret to order details
    partialFills?: PartialFill[];
    totalFills?: number;
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
  const { toast } = useToast();
  // Dynamic time estimates based on step and mode
  const getEstimatedTime = () => {
    if (process.env.NODE_ENV === 'development' && isMockMode) return 30; // Mock mode is faster
    
    switch (currentStep) {
      case 0: return 15;  // Creating order
      case 1: return 45;  // Deploying escrows
      case 2: return 30;  // User claiming
      case 3: return 20;  // Resolver claiming
      default: return 120; // Total estimate
    }
  };
  
  const [timeRemaining, setTimeRemaining] = useState(estimatedTime);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (status === 'creating') setCurrentStep(0);      // Creating order
    else if (status === 'pending') setCurrentStep(1);   // Waiting for resolver to deploy escrows
    else if (status === 'processing') {
      // Check if we have transaction hashes to determine which step we're in
      if (orderDetails?.txHashes?.destinationWithdrawal) {
        setCurrentStep(3); // Resolver claiming
      } else if (orderDetails?.txHashes?.destinationDeployment) {
        setCurrentStep(2); // User can claim
      } else {
        setCurrentStep(2); // Default to processing
      }
    }
    else if (status === 'completed') setCurrentStep(4);  // All done
    else if (status === 'failed') setCurrentStep(-1);
  }, [status, orderDetails]);

  // Update time remaining when step changes
  useEffect(() => {
    setTimeRemaining(getEstimatedTime());
  }, [currentStep]);

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

  const copySecret = async () => {
    if (orderDetails?.secret) {
      await navigator.clipboard.writeText(orderDetails.secret);
      toast({
        title: "Secret copied!",
        description: "The HTLC secret has been copied to your clipboard.",
      });
    }
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  // Get transaction status indicator
  const getTxStatusIcon = (txHash: string | undefined) => {
    if (!txHash) return null;
    if (status === 'completed') {
      return <CheckCircle2 className="w-3 h-3 text-green-500" />;
    }
    return <Loader2 className="w-3 h-3 text-brand-primary animate-spin" />;
  };

  // Get step-specific message
  const getStepMessage = () => {
    if (!isMockMode) {
      switch (currentStep) {
        case 0: return 'Preparing your cross-chain order...';
        case 1: return 'Resolver is deploying secure escrow contracts on both chains...';
        case 2: return 'Escrows deployed! You can now claim your tokens on the destination chain.';
        case 3: return 'You\'ve claimed! Resolver is now claiming on the source chain...';
        case 4: return 'Swap completed successfully!';
        default: return config.description;
      }
    }
    return config.description;
  };

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
              <p className="text-sm text-neutral-300">{getStepMessage()}</p>
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
            
            {!isMockMode && (status === 'pending' || status === 'processing') && (
              <div>
                <div className="text-xs text-neutral-400 mb-1">Network Fees</div>
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Ethereum:</span>
                    <span className="text-neutral-200">~$5-15 (gas)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-300">Stellar:</span>
                    <span className="text-neutral-200">~$0.001 (XLM)</span>
                  </div>
                </div>
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
                      {orderDetails.escrowAddresses.destination && orderDetails.escrowAddresses.destination.startsWith('C') && (
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
                      <span className="text-neutral-300 flex items-center gap-1">
                        Ethereum Escrow:
                        {getTxStatusIcon(orderDetails.txHashes.sourceDeployment)}
                      </span>
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
                      <span className="text-neutral-300 flex items-center gap-1">
                        Stellar Escrow:
                        {getTxStatusIcon(orderDetails.txHashes.destinationDeployment)}
                      </span>
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
                      <span className="text-neutral-300 flex items-center gap-1">
                        ETH Withdrawal:
                        {getTxStatusIcon(orderDetails.txHashes.sourceWithdrawal)}
                      </span>
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
                      <span className="text-neutral-300 flex items-center gap-1">
                        XLM Withdrawal:
                        {getTxStatusIcon(orderDetails.txHashes.destinationWithdrawal)}
                      </span>
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

        {/* Partial Fills Progress */}
        {orderDetails?.partialFills && orderDetails.partialFills.length > 0 && (
          <div className="bg-neutral-800/50 rounded-lg p-3 mb-4">
            <div className="text-xs text-neutral-400 mb-2">Partial Fills Progress</div>
            
            {/* Overall Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-neutral-300 mb-1">
                <span>Total Progress</span>
                <span>{Math.round(orderDetails.partialFills.reduce((sum, fill) => sum + (fill.status === 'completed' ? fill.percentage : 0), 0))}%</span>
              </div>
              <div className="w-full bg-neutral-700 rounded-full h-2">
                <div 
                  className="bg-brand-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${orderDetails.partialFills.reduce((sum, fill) => sum + (fill.status === 'completed' ? fill.percentage : 0), 0)}%` }}
                  aria-valuenow={orderDetails.partialFills.reduce((sum, fill) => sum + (fill.status === 'completed' ? fill.percentage : 0), 0)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
            
            {/* Individual Fills */}
            <div className="space-y-2">
              {orderDetails.partialFills.map((fill, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">Fill #{fill.index}</span>
                    <span className="text-neutral-300">{fill.amount}</span>
                    <span className="text-neutral-500">({fill.percentage}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {fill.status === 'completed' ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        {fill.txHash && (
                          <a
                            href={`https://etherscan.io/tx/${fill.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-neutral-200"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </>
                    ) : (
                      <Loader2 className="w-3 h-3 text-neutral-400 animate-spin" />
                    )}
                  </div>
                </div>
              ))}
            </div>
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
              {isMockMode ? (
                <>A resolver has accepted your order and is deploying secure escrow contracts on both Ethereum and Stellar. This ensures atomic execution of your swap.</>
              ) : (
                <>
                  <strong>Live Transaction:</strong> A resolver is deploying real escrow contracts on-chain. 
                  Ethereum gas fees apply. This typically takes 30-60 seconds depending on network congestion.
                </>
              )}
            </div>
          </div>
        )}

        {status === 'processing' && currentStep === 2 && (
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="text-sm text-neutral-300">
              {isMockMode ? (
                <>The HTLC (Hash Time-Locked Contract) swap is executing. You&apos;ll receive tokens on the destination chain once you reveal the secret.</>
              ) : (
                <>
                  <strong>Action Required:</strong> Escrows are deployed! You can now claim your tokens on Stellar. 
                  The transaction will reveal the secret, allowing the resolver to claim on Ethereum.
                </>
              )}
            </div>
          </div>
        )}

        {status === 'processing' && currentStep === 3 && (
          <div className="bg-neutral-800/50 rounded-lg p-3">
            <div className="text-sm text-neutral-300">
              <strong>Almost Done:</strong> You&apos;ve successfully claimed on Stellar! The resolver is now using the revealed secret 
              to claim on Ethereum. This completes the atomic swap.
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
            
            {/* Display secret if available */}
            {orderDetails?.secret && (
              <div className="bg-neutral-800/50 rounded-lg p-3 mb-3">
                <div className="text-xs text-neutral-400 mb-2">HTLC Secret (for manual recovery if needed)</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-neutral-200 break-all flex-1">{orderDetails.secret}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copySecret}
                    className="shrink-0"
                    title="Copy secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {isMockMode ? (
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">Demo Note:</span> The Stellar contract is deployed on mainnet and verifiable. 
                  Ethereum transactions are simulated for demo safety. In production, both chains would have real transactions.
                </div>
              </div>
            ) : (
              <div className="bg-neutral-800/50 rounded-lg p-3">
                <div className="text-xs text-neutral-400">
                  <span className="font-medium text-neutral-300">Live Mode:</span> Each swap deploys a new HTLC escrow contract via the factory pattern. View the{' '}
                  <a 
                    href="https://stellar.expert/explorer/public/search?term=escrow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-300 hover:text-neutral-100 underline"
                  >
                    Stellar escrows
                  </a>
                  . Transaction hashes above are real and can be verified on-chain.
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}