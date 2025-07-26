// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILimitOrderProtocol {
    struct Order {
        uint256 salt;
        address maker;
        address receiver;
        address makerAsset;
        address takerAsset;
        uint256 makingAmount;
        uint256 takingAmount;
        bytes makerTraits;
    }
    
    function fillOrder(
        Order calldata order,
        bytes calldata signature,
        bytes calldata interaction,
        uint256 makingAmount,
        uint256 takingAmount,
        uint256 skipPermitAndThresholdAmount
    ) external returns (uint256, uint256, bytes32);
    
    function cancelOrder(Order calldata order) external;
    
    function hashOrder(Order calldata order) external view returns (bytes32);
}