// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HTLCEscrowFactory.sol";
import "./HTLCEscrow.sol";
import "./interfaces/ILimitOrderProtocol.sol";

/**
 * @title Resolver
 * @notice Resolver contract for cross-chain swaps between Base and Stellar
 * @dev Integrates with 1inch Fusion+ protocol for atomic cross-chain swaps
 */
contract Resolver is Ownable {
    using SafeERC20 for IERC20;

    HTLCEscrowFactory private immutable _htlcFactory;
    ILimitOrderProtocol private immutable _limitOrderProtocol;

    event OrderFilled(bytes32 indexed orderHash, address indexed taker, uint256 makingAmount);
    event EscrowDeployed(address indexed escrow, bytes32 indexed orderHash);
    event SecretRevealed(bytes32 indexed orderHash, bytes32 secret);

    constructor(address htlcFactory, address limitOrderProtocol) Ownable(msg.sender) {
        require(htlcFactory != address(0), "Invalid HTLC factory");
        require(limitOrderProtocol != address(0), "Invalid LOP");
        
        _htlcFactory = HTLCEscrowFactory(htlcFactory);
        _limitOrderProtocol = ILimitOrderProtocol(limitOrderProtocol);
    }

    /**
     * @notice Fill order and deploy source escrow
     * @param order The Fusion+ order to fill
     * @param signature Order signature
     * @param hashlock The hashlock for atomic swap
     * @param makingAmount Amount of maker asset to fill
     * @param takingAmount Amount of taker asset to fill
     */
    function fillOrderWithEscrow(
        ILimitOrderProtocol.Order calldata order,
        bytes calldata signature,
        bytes32 hashlock,
        uint256 makingAmount,
        uint256 takingAmount
    ) external payable onlyOwner returns (uint256, uint256, bytes32) {
        // Fill order first
        bytes32 orderHash = _limitOrderProtocol.hashOrder(order);
        
        (uint256 actualMaking, uint256 actualTaking, bytes32 actualOrderHash) = 
            _limitOrderProtocol.fillOrder(order, signature, "", makingAmount, takingAmount, 0);
        
        // Deploy HTLC escrow after order is filled
        _deployHTLCEscrow(orderHash, hashlock, order.maker, order.makerAsset, actualMaking);
        
        return (actualMaking, actualTaking, actualOrderHash);
    }
    
    function _deployHTLCEscrow(
        bytes32 orderHash,
        bytes32 hashlock,
        address maker,
        address makerAsset,
        uint256 amount
    ) private returns (address) {
        IHTLCEscrow.Immutables memory immutables = IHTLCEscrow.Immutables({
            orderHash: orderHash,
            srcToken: makerAsset,
            srcAmount: amount,
            srcReceiver: address(this), // Resolver receives on Base
            hashlock: hashlock,
            timelock: block.timestamp + 7200, // 2 hours
            maker: maker,
            taker: address(this)
        });
        
        address escrow = _htlcFactory.deployEscrow(immutables);
        emit EscrowDeployed(escrow, orderHash);
        return escrow;
    }

    /**
     * @notice Deploy destination escrow (for Stellar side)
     * @param orderHash The order hash for the escrow
     */
    function deployDstEscrow(bytes32 orderHash) external onlyOwner {
        // In production, this would trigger Stellar escrow deployment
        // For now, we emit an event that the off-chain service monitors
        emit EscrowDeployed(address(0), orderHash);
    }

    /**
     * @notice Withdraw funds using revealed secret
     * @param escrow The escrow contract address
     * @param secret The revealed secret
     */
    function withdraw(address escrow, bytes32 secret) external {
        // Call withdraw on the HTLC escrow contract
        IHTLCEscrow(escrow).withdraw(secret);
        
        // Extract order hash from escrow
        bytes32 orderHash = IHTLCEscrow(escrow).orderHash();
        emit SecretRevealed(orderHash, secret);
    }

    /**
     * @notice Rescue stuck tokens
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to rescue
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}

