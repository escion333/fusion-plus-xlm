// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SimpleEscrowFactory
 * @notice A basic escrow factory for demonstration purposes
 * @dev This is a simplified version for the hackathon demo
 */
contract SimpleEscrowFactory {
    event EscrowCreated(
        address indexed escrow,
        bytes32 indexed orderHash,
        address indexed creator
    );
    
    mapping(bytes32 => address) public escrows;
    
    /**
     * @notice Create a new escrow for cross-chain swap
     * @param orderHash The hash of the order
     * @param hashlock The hashlock for atomic swap
     * @param maker The maker address
     * @param taker The taker address  
     * @param token The token to escrow
     * @param amount The amount to escrow
     * @return escrow The deployed escrow address
     */
    function createEscrow(
        uint256 orderHash,
        bytes32 hashlock,
        address maker,
        address taker,
        address token,
        uint256 amount,
        uint256 safetyDeposit,
        uint256 timelocks
    ) external returns (address escrow) {
        bytes32 orderHashBytes = bytes32(orderHash);
        
        // For demo purposes, we'll use a simple deterministic address
        // In production, this would deploy a real escrow contract
        escrow = address(uint160(uint256(keccak256(abi.encodePacked(
            orderHashBytes,
            hashlock,
            maker,
            block.timestamp
        )))));
        
        escrows[orderHashBytes] = escrow;
        
        emit EscrowCreated(escrow, orderHashBytes, msg.sender);
        
        return escrow;
    }
    
    /**
     * @notice Get escrow address for an order
     * @param orderHash The order hash
     * @return The escrow address
     */
    function getEscrow(bytes32 orderHash) external view returns (address) {
        return escrows[orderHash];
    }
}