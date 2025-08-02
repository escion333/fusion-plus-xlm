// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IHTLCEscrow {
    struct Immutables {
        bytes32 orderHash;
        address srcToken;
        uint256 srcAmount;
        address srcReceiver;
        bytes32 hashlock;
        uint256 timelock;
        address maker;
        address taker;
    }

    function initialize(Immutables calldata imm) external;
    function deposit() external payable;
    function withdraw(bytes32 secret) external;
    function refund() external;
    function orderHash() external view returns (bytes32);
    
    event Deposited(address indexed sender, uint256 amount);
    event Withdrawn(address indexed receiver, bytes32 secret);
    event Refunded(address indexed sender);
}

contract HTLCEscrow is IHTLCEscrow {
    using SafeERC20 for IERC20;
    
    // State variables
    address public srcToken;
    uint256 public srcAmount;
    address public srcReceiver;
    bytes32 public hashlock;
    uint256 public timelock;
    address public maker;
    address public taker;
    bytes32 public orderHash;
    
    bool public deposited;
    bool public withdrawn;
    bool public refunded;
    bytes32 public revealedSecret;
    
    modifier onlyOnce() {
        require(!deposited && !withdrawn && !refunded, "Already executed");
        _;
    }
    
    modifier hashMatches(bytes32 secret) {
        require(keccak256(abi.encodePacked(secret)) == hashlock, "Invalid secret");
        _;
    }
    
    modifier withdrawable() {
        require(deposited, "Not deposited");
        require(!withdrawn, "Already withdrawn");
        require(!refunded, "Already refunded");
        _;
    }
    
    modifier refundable() {
        require(deposited, "Not deposited");
        require(!withdrawn, "Already withdrawn");
        require(!refunded, "Already refunded");
        require(block.timestamp >= timelock, "Timelock not expired");
        _;
    }
    
    function initialize(Immutables calldata imm) external onlyOnce {
        orderHash = imm.orderHash;
        srcToken = imm.srcToken;
        srcAmount = imm.srcAmount;
        srcReceiver = imm.srcReceiver;
        hashlock = imm.hashlock;
        timelock = imm.timelock;
        maker = imm.maker;
        taker = imm.taker;
    }
    
    function deposit() external payable {
        require(!deposited, "Already deposited");
        require(msg.sender == maker, "Only maker can deposit");
        
        if (srcToken == address(0)) {
            require(msg.value == srcAmount, "Incorrect ETH amount");
        } else {
            require(msg.value == 0, "No ETH expected");
            IERC20(srcToken).safeTransferFrom(msg.sender, address(this), srcAmount);
        }
        
        deposited = true;
        emit Deposited(msg.sender, srcAmount);
    }
    
    function withdraw(bytes32 secret) external withdrawable hashMatches(secret) {
        withdrawn = true;
        revealedSecret = secret;
        
        address receiver = srcReceiver != address(0) ? srcReceiver : taker;
        
        if (srcToken == address(0)) {
            payable(receiver).transfer(srcAmount);
        } else {
            IERC20(srcToken).safeTransfer(receiver, srcAmount);
        }
        
        emit Withdrawn(receiver, secret);
    }
    
    function refund() external refundable {
        require(msg.sender == maker, "Only maker can refund");
        refunded = true;
        
        if (srcToken == address(0)) {
            payable(maker).transfer(srcAmount);
        } else {
            IERC20(srcToken).safeTransfer(maker, srcAmount);
        }
        
        emit Refunded(maker);
    }
    
    function getDetails() external view returns (
        address _srcToken,
        uint256 _srcAmount,
        address _srcReceiver,
        bytes32 _hashlock,
        uint256 _timelock,
        address _maker,
        address _taker,
        bool _deposited,
        bool _withdrawn,
        bool _refunded,
        bytes32 _revealedSecret
    ) {
        return (
            srcToken,
            srcAmount,
            srcReceiver,
            hashlock,
            timelock,
            maker,
            taker,
            deposited,
            withdrawn,
            refunded,
            revealedSecret
        );
    }
}