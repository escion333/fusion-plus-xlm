// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./HTLCEscrow.sol";

contract HTLCEscrowFactory {
    event EscrowDeployed(bytes32 indexed orderHash, address escrow);
    
    address public immutable implementation;
    mapping(address => bool) public escrows;
    
    constructor() {
        implementation = address(new HTLCEscrow());
    }
    
    function deployEscrow(IHTLCEscrow.Immutables calldata imm) 
        external 
        returns (address escrow) 
    {
        bytes32 salt = imm.orderHash;
        bytes memory init = abi.encodeWithSelector(IHTLCEscrow.initialize.selector, imm);
        
        // Deploy minimal proxy (EIP-1167)
        bytes memory bytecode = _getCloneBytecode();
        assembly {
            escrow := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(escrow)) { revert(0, 0) }
        }
        
        // Initialize the escrow
        (bool ok, ) = escrow.call(init);
        require(ok, "Initialize failed");
        
        escrows[escrow] = true;
        emit EscrowDeployed(imm.orderHash, escrow);
    }
    
    function predictEscrow(bytes32 orderHash) external view returns (address) {
        bytes32 salt = orderHash;
        bytes32 bytecodeHash = keccak256(_getCloneBytecode());
        
        return address(uint160(uint256(
            keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, bytecodeHash))
        )));
    }
    
    function getEscrowAddress(
        address srcToken,
        uint256 srcAmount,
        bytes32 hashlock,
        uint256 timelock,
        address maker,
        address taker
    ) external view returns (address) {
        bytes32 orderHash = keccak256(abi.encodePacked(
            srcToken,
            srcAmount,
            hashlock,
            timelock,
            maker,
            taker
        ));
        
        return this.predictEscrow(orderHash);
    }
    
    function _getCloneBytecode() private view returns (bytes memory) {
        bytes20 targetBytes = bytes20(implementation);
        return abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            targetBytes,
            hex"5af43d82803e903d91602b57fd5bf3"
        );
    }
}