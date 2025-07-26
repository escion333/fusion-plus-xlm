// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IEscrowFactory {
    function createEscrow(
        uint256 orderHash,
        bytes32 hashlock,
        address srcMaker,
        address srcTaker,
        address srcToken,
        uint256 srcAmount,
        uint256 safetyDeposit,
        uint256 timelocks
    ) external returns (address escrow);
    
    function getEscrowAddress(
        uint256 orderHash,
        bytes32 hashlock,
        address srcMaker,
        address srcTaker,
        address srcToken,
        uint256 srcAmount,
        uint256 safetyDeposit,
        uint256 timelocks
    ) external view returns (address);
}