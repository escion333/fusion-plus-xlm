import { ethers } from 'ethers';

export interface AuctionParams {
  startAmount: string;
  endAmount: string;
  startTime: number;
  endTime: number;
  initialRateBump?: number;
}

export interface AuctionState {
  currentAmount: string;
  progress: number;
  timeRemaining: number;
  isActive: boolean;
}

export class DutchAuction {
  /**
   * Calculate current auction state
   */
  static getCurrentState(params: AuctionParams, currentTime?: number): AuctionState {
    const now = currentTime || Math.floor(Date.now() / 1000);
    
    // Check if auction hasn't started
    if (now < params.startTime) {
      return {
        currentAmount: params.startAmount,
        progress: 0,
        timeRemaining: params.endTime - now,
        isActive: false,
      };
    }
    
    // Check if auction has ended
    if (now >= params.endTime) {
      return {
        currentAmount: params.endAmount,
        progress: 100,
        timeRemaining: 0,
        isActive: false,
      };
    }
    
    // Calculate auction progress
    const duration = params.endTime - params.startTime;
    const elapsed = now - params.startTime;
    const progress = (elapsed / duration) * 100;
    
    // Calculate current amount (linear interpolation)
    const currentAmount = this.calculateAmount(params, progress);
    
    return {
      currentAmount,
      progress,
      timeRemaining: params.endTime - now,
      isActive: true,
    };
  }
  
  /**
   * Calculate amount at given progress percentage
   */
  static calculateAmount(params: AuctionParams, progressPercent: number): string {
    const start = BigInt(params.startAmount);
    const end = BigInt(params.endAmount);
    
    // Apply initial rate bump if specified
    let adjustedStart = start;
    if (params.initialRateBump && params.initialRateBump > 0) {
      adjustedStart = (start * BigInt(100 + params.initialRateBump)) / 100n;
    }
    
    // Linear interpolation
    const diff = adjustedStart - end;
    const reduction = (diff * BigInt(Math.floor(progressPercent))) / 100n;
    const current = adjustedStart - reduction;
    
    return current.toString();
  }
  
  /**
   * Calculate optimal bid time for a resolver
   */
  static calculateOptimalBidTime(
    params: AuctionParams,
    targetProfitPercent: number,
    marketPrice: string
  ): number | null {
    const marketAmount = BigInt(marketPrice);
    const targetAmount = (marketAmount * BigInt(100 - targetProfitPercent)) / 100n;
    
    // If target is already better than end amount, bid immediately
    if (targetAmount >= BigInt(params.endAmount)) {
      return params.startTime;
    }
    
    // If target is worse than start amount, can't achieve profit
    if (targetAmount <= BigInt(params.startAmount)) {
      return null;
    }
    
    // Calculate when auction will reach target amount
    const start = BigInt(params.startAmount);
    const end = BigInt(params.endAmount);
    const progress = ((start - targetAmount) * 100n) / (start - end);
    
    const duration = params.endTime - params.startTime;
    const timeToWait = (duration * Number(progress)) / 100;
    
    return params.startTime + Math.floor(timeToWait);
  }
  
  /**
   * Simulate auction for demo
   */
  static createDemoAuction(
    makingAmount: string,
    improvementPercent: number = 5,
    durationSeconds: number = 300
  ): AuctionParams {
    const now = Math.floor(Date.now() / 1000);
    const startAmount = makingAmount;
    const endAmount = (BigInt(makingAmount) * BigInt(100 - improvementPercent) / 100n).toString();
    
    return {
      startAmount,
      endAmount,
      startTime: now,
      endTime: now + durationSeconds,
      initialRateBump: 0,
    };
  }
  
  /**
   * Format auction state for display
   */
  static formatState(state: AuctionState, decimals: number = 6): any {
    return {
      currentAmount: ethers.formatUnits(state.currentAmount, decimals),
      progress: `${state.progress.toFixed(1)}%`,
      timeRemaining: this.formatTime(state.timeRemaining),
      isActive: state.isActive,
    };
  }
  
  /**
   * Format time in human-readable format
   */
  static formatTime(seconds: number): string {
    if (seconds <= 0) return 'Ended';
    
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  }
  
  /**
   * Create visualization data for auction curve
   */
  static getVisualizationData(params: AuctionParams, points: number = 20): any[] {
    const data: any[] = [];
    
    for (let i = 0; i <= points; i++) {
      const progress = (i / points) * 100;
      const time = params.startTime + ((params.endTime - params.startTime) * i / points);
      const amount = this.calculateAmount(params, progress);
      
      data.push({
        time: new Date(time * 1000).toISOString(),
        progress,
        amount,
        formattedAmount: ethers.formatUnits(amount, 6),
      });
    }
    
    return data;
  }
}

export default DutchAuction;