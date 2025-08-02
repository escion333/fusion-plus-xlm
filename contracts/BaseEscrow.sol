// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBaseEscrow {
    struct Immutables {
        bytes32 orderHash;
        bytes32 hashlock;
        address maker;
        address taker;
        address token;
        uint256 amount;
        uint256 safetyDeposit;
        uint64 timelocks; // 7-stage packed
    }
    
    function initialize(Immutables calldata imm) external;
    function withdraw(bytes32 secret) external;
    function cancel() external;
}

contract BaseEscrow is ReentrancyGuard, IBaseEscrow {
    Immutables public imm;

    enum State { Init, Locked, Withdrawn, Cancelled }
    State public state;

    event Withdrawn(bytes32 orderHash, address to, uint256 amount);
    event Cancelled(bytes32 orderHash);

    function initialize(Immutables calldata _imm) external override {
        require(state == State.Init, "already init");
        imm = _imm;
        state = State.Locked;

        IERC20(imm.token).transferFrom(
            msg.sender,
            address(this),
            imm.amount + imm.safetyDeposit
        );
    }

    function withdraw(bytes32 secret) external override nonReentrant {
        require(state == State.Locked, "bad state");
        require(keccak256(abi.encodePacked(secret)) == imm.hashlock, "bad secret");
        state = State.Withdrawn;
        IERC20(imm.token).transfer(imm.taker, imm.amount);
        emit Withdrawn(imm.orderHash, imm.taker, imm.amount);
    }

    function cancel() external override nonReentrant {
        require(block.timestamp > timelockExpiry(), "too early");
        state = State.Cancelled;
        IERC20(imm.token).transfer(imm.maker, imm.amount + imm.safetyDeposit);
        emit Cancelled(imm.orderHash);
    }

    function timelockExpiry() public view returns (uint256) {
        // For demo: simple timelock (1 hour from deployment)
        // In production, would decode the 7-stage packed timelocks
        return block.timestamp + 3600;
    }
}