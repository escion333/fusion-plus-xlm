// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseEscrow.sol";

contract EscrowFactory {
    event EscrowDeployed(bytes32 indexed orderHash, address escrow);

    address public immutable implementation;

    constructor(address _impl) {
        implementation = _impl;
    }

    function deployEscrow(IBaseEscrow.Immutables calldata imm)
        external
        returns (address escrow)
    {
        bytes32 salt = imm.orderHash;
        bytes memory init = abi.encodeWithSelector(IBaseEscrow.initialize.selector, imm);

        bytes20 targetBytes = bytes20(implementation);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3) // EIP-1167 prefix
            mstore(add(clone, 0x14), shl(0x60, targetBytes))
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf3) // suffix
            escrow := create2(0, clone, 0x37, salt)
            if iszero(escrow) { revert(0, 0) }
        }

        (bool ok, ) = escrow.call(init);
        require(ok, "init failed");
        emit EscrowDeployed(imm.orderHash, escrow);
    }

    function predictEscrow(bytes32 orderHash) external view returns (address) {
        bytes32 salt = orderHash;
        bytes20 targetBytes = bytes20(implementation);
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                hex"3d602d80600a3d3981f3",
                targetBytes,
                hex"5af43d82803e903d91602b57fd5bf3"
            )
        );
        return address(uint160(uint(
            keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash))
        )));
    }
}