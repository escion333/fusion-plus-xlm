import { Interface, TransactionRequest } from 'ethers';

// This is based on the 1inch cross-chain resolver example
// We're keeping their exact interface for EVM chains
export class Resolver {
  private readonly iface: Interface;

  constructor(
    public readonly srcAddress: string,
    public readonly dstAddress: string
  ) {
    // In production, this would use the actual Resolver ABI
    // For demo, we'll use a simplified interface
    this.iface = new Interface([
      'function deploySrc(tuple(address,address,uint256,uint256,bytes32,uint256,uint256) immutables, tuple(uint256,address,address,address,address,uint256,uint256) order, bytes32 r, bytes32 vs, uint256 amount, uint256 takerTraits, bytes args) payable',
      'function deployDst(tuple(address,address,uint256,uint256,bytes32,uint256,uint256) immutables, uint256 srcCancellationTimestamp) payable',
      'function withdraw(address escrow, bytes32 secret, tuple(address,address,uint256,uint256,bytes32,uint256,uint256) immutables)',
      'function cancel(address escrow, tuple(address,address,uint256,uint256,bytes32,uint256,uint256) immutables)'
    ]);
  }

  public deploySrc(
    chainId: number,
    order: any,
    signature: string,
    takerTraits: any,
    amount: bigint,
    hashLock?: any
  ): TransactionRequest {
    // This follows the exact pattern from 1inch example
    const immutables = order.toSrcImmutables(chainId, this.srcAddress, amount, hashLock);
    
    return {
      to: this.srcAddress,
      data: this.iface.encodeFunctionData('deploySrc', [
        immutables.build(),
        order.build(),
        signature.slice(0, 66), // r
        '0x' + signature.slice(66), // vs
        amount,
        takerTraits.trait,
        takerTraits.args || '0x'
      ]),
      value: order.escrowExtension.srcSafetyDeposit
    };
  }

  public deployDst(immutables: any): TransactionRequest {
    return {
      to: this.dstAddress,
      data: this.iface.encodeFunctionData('deployDst', [
        immutables.build(),
        immutables.timeLocks.toSrcTimeLocks().privateCancellation
      ]),
      value: immutables.safetyDeposit
    };
  }

  public withdraw(
    side: 'src' | 'dst',
    escrow: string,
    secret: string,
    immutables: any
  ): TransactionRequest {
    return {
      to: side === 'src' ? this.srcAddress : this.dstAddress,
      data: this.iface.encodeFunctionData('withdraw', [
        escrow,
        secret,
        immutables.build()
      ])
    };
  }

  public cancel(
    side: 'src' | 'dst',
    escrow: string,
    immutables: any
  ): TransactionRequest {
    return {
      to: side === 'src' ? this.srcAddress : this.dstAddress,
      data: this.iface.encodeFunctionData('cancel', [
        escrow,
        immutables.build()
      ])
    };
  }
}