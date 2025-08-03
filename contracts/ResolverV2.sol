// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./HTLCEscrowFactory.sol";
import "./HTLCEscrow.sol";
import "./interfaces/ILimitOrderProtocol.sol";

/**
 * @title ResolverV2 - Enhanced Cross-Chain Atomic Swap Resolver
 * @author Fusion+ Team
 * @notice Advanced resolver contract for 1inch Fusion+ cross-chain atomic swaps with Stellar confirmation
 * 
 * @dev This contract orchestrates cross-chain atomic swaps between EVM-compatible chains and Stellar network.
 * It integrates with 1inch Limit Order Protocol for order execution and HTLC escrows for atomic swap security.
 * 
 * Key Features:
 * - Integration with 1inch Limit Order Protocol for seamless order execution
 * - HTLC escrow deployment and management for atomic swap security
 * - Stellar confirmation requirement before allowing source chain withdrawals
 * - Trusted oracle system for cross-chain transaction verification
 * - Emergency withdrawal mechanisms for edge cases
 * - Comprehensive event logging for monitoring and analytics
 * 
 * Security Model:
 * - Requires Stellar oracle confirmation before allowing withdrawals
 * - Owner-only access for critical operations
 * - Time-based escrow releases prevent indefinite fund locking
 * - Emergency mechanisms for oracle failure scenarios
 * 
 * Cross-Chain Flow:
 * 1. User submits order to Fusion+ protocol
 * 2. Resolver fills order and deploys source escrow with user funds
 * 3. Resolver provides liquidity on destination chain (Stellar)
 * 4. Oracle confirms destination transaction
 * 5. Resolver withdraws from source escrow using revealed secret
 * 
 * @custom:version 2.0.0
 * @custom:security-contact security@fusion-plus.com
 */
contract ResolverV2 is Ownable {
    using SafeERC20 for IERC20;

    /// @dev HTLC escrow factory for deploying atomic swap contracts
    HTLCEscrowFactory private immutable _htlcFactory;
    
    /// @dev 1inch Limit Order Protocol contract for order execution
    ILimitOrderProtocol private immutable _limitOrderProtocol;
    
    /// @notice Mapping from order hash to Stellar confirmation status
    /// @dev Tracks whether the destination leg of each atomic swap has been confirmed
    mapping(bytes32 => bool) public stellarConfirmed;
    
    /// @notice Address of the trusted oracle that confirms Stellar transactions
    /// @dev This oracle is responsible for verifying destination chain transactions
    address public stellarOracle;

    /// @notice Emitted when a Fusion+ order is successfully filled
    /// @param orderHash The hash of the filled order
    /// @param taker The address that filled the order (usually this resolver)
    /// @param makingAmount The amount of maker asset that was filled
    event OrderFilled(bytes32 indexed orderHash, address indexed taker, uint256 makingAmount);
    
    /// @notice Emitted when an HTLC escrow contract is deployed
    /// @param escrow The address of the deployed escrow contract
    /// @param orderHash The hash of the order associated with this escrow
    event EscrowDeployed(address indexed escrow, bytes32 indexed orderHash);
    
    /// @notice Emitted when the atomic swap secret is revealed during withdrawal
    /// @param orderHash The hash of the order whose secret was revealed
    /// @param secret The revealed secret used for the atomic swap
    event SecretRevealed(bytes32 indexed orderHash, bytes32 secret);
    
    /// @notice Emitted when a Stellar transaction is confirmed by the oracle
    /// @param orderHash The hash of the order that was confirmed
    /// @param stellarEscrow The Stellar escrow address (for reference)
    event StellarConfirmed(bytes32 indexed orderHash, address stellarEscrow);
    
    /// @notice Emitted when the Stellar oracle address is updated
    /// @param oldOracle The previous oracle address
    /// @param newOracle The new oracle address
    event StellarOracleUpdated(address oldOracle, address newOracle);

    /**
     * @notice Initializes the ResolverV2 contract with required dependencies
     * @dev Sets up immutable references to factory and protocol contracts
     * 
     * @param htlcFactory Address of the HTLC escrow factory contract
     * @param limitOrderProtocol Address of the 1inch Limit Order Protocol contract
     * @param _stellarOracle Address of the trusted Stellar transaction oracle
     * 
     * Requirements:
     * - All addresses must be non-zero
     * - Contracts must be properly deployed and functional
     * - Oracle must be a trusted entity for cross-chain verification
     */
    constructor(address htlcFactory, address limitOrderProtocol, address _stellarOracle) Ownable(msg.sender) {
        require(htlcFactory != address(0), "Invalid HTLC factory");
        require(limitOrderProtocol != address(0), "Invalid LOP");
        require(_stellarOracle != address(0), "Invalid Stellar oracle");
        
        _htlcFactory = HTLCEscrowFactory(htlcFactory);
        _limitOrderProtocol = ILimitOrderProtocol(limitOrderProtocol);
        stellarOracle = _stellarOracle;
    }

    /**
     * @notice Returns the HTLC factory contract address
     * @return The address of the HTLC escrow factory
     */
    function factory() external view returns (address) {
        return address(_htlcFactory);
    }

    /**
     * @notice Returns the 1inch Limit Order Protocol contract address
     * @return The address of the 1inch LOP contract
     */
    function limitOrderProtocol() external view returns (address) {
        return address(_limitOrderProtocol);
    }

    /**
     * @notice Updates the trusted Stellar oracle address
     * @dev Only the contract owner can update the oracle address
     * 
     * @param newOracle The new oracle address to set
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - New oracle address must not be zero
     * - New oracle must be a trusted entity
     * 
     * Emits a {StellarOracleUpdated} event.
     * 
     * Security Considerations:
     * - Oracle has significant power in the system
     * - Should only be changed in emergency situations
     * - New oracle must be thoroughly vetted
     */
    function setStellarOracle(address newOracle) external onlyOwner {
        require(newOracle != address(0), "Invalid oracle");
        address oldOracle = stellarOracle;
        stellarOracle = newOracle;
        emit StellarOracleUpdated(oldOracle, newOracle);
    }

    /**
     * @notice Confirms that a Stellar escrow has been successfully deployed and funded
     * @dev Only the trusted oracle can call this function
     * 
     * This function is called by the oracle after verifying that:
     * - The Stellar escrow contract has been deployed
     * - The resolver has provided the required liquidity
     * - The hashlock and timelocks are configured correctly
     * 
     * @param orderHash The hash of the order being confirmed
     * @param stellarEscrow The Stellar escrow contract address (for reference)
     * 
     * Requirements:
     * - Caller must be the designated oracle
     * - Order must not already be confirmed
     * - Stellar transaction must be verified off-chain
     * 
     * Emits a {StellarConfirmed} event.
     * 
     * Security Considerations:
     * - Oracle must verify Stellar transaction before calling
     * - Prevents double-confirmation attacks
     * - Enables atomic swap completion
     */
    function confirmStellarEscrow(bytes32 orderHash, address stellarEscrow) external {
        require(msg.sender == stellarOracle, "Only oracle");
        require(!stellarConfirmed[orderHash], "Already confirmed");
        
        stellarConfirmed[orderHash] = true;
        emit StellarConfirmed(orderHash, stellarEscrow);
    }

    /**
     * @notice Fills a Fusion+ order and deploys the source chain HTLC escrow
     * @dev Combines order execution with escrow deployment in a single transaction
     * 
     * This function orchestrates the source side of the atomic swap:
     * 1. Executes the order through 1inch Limit Order Protocol
     * 2. Receives the maker's tokens from the order fill
     * 3. Deploys an HTLC escrow with those tokens
     * 4. Configures the escrow with proper hashlock and timelock
     * 
     * @param order The complete Fusion+ order structure
     * @param signature The maker's EIP-712 signature for the order
     * @param hashlock The keccak256 hash of the atomic swap secret
     * @param makingAmount Amount of maker asset to fill (must not exceed order amount)
     * @param takingAmount Amount of taker asset to fill (must not exceed order amount)
     * 
     * @return actualMaking The actual amount of maker asset that was filled
     * @return actualTaking The actual amount of taker asset that was filled
     * @return actualOrderHash The hash of the order that was processed
     * 
     * Requirements:
     * - Caller must be the contract owner (resolver)
     * - Order must be valid and properly signed
     * - Sufficient allowance/balance for token transfers
     * - Hashlock must be properly formatted (32 bytes)
     * 
     * Emits {OrderFilled} and {EscrowDeployed} events.
     * 
     * Security Considerations:
     * - Order validation is handled by 1inch protocol
     * - Escrow is immediately funded with received tokens
     * - Hashlock binds this escrow to destination escrow
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
    
    /**
     * @notice Internal function to deploy an HTLC escrow contract
     * @dev Creates a new escrow with the specified parameters
     * 
     * This function:
     * - Deploys a new HTLC escrow using the factory
     * - Configures it with proper hashlock and timelock
     * - Sets up maker/taker relationships for atomic swap
     * - Transfers tokens to the escrow for holding
     * 
     * @param orderHash The hash of the order this escrow represents
     * @param hashlock The keccak256 hash of the atomic swap secret
     * @param maker The original order maker (user)
     * @param makerAsset The token being escrowed
     * @param amount The amount of tokens to escrow
     * 
     * @return The address of the deployed escrow contract
     * 
     * Requirements:
     * - Factory must be functional
     * - Hashlock must be valid
     * - Sufficient token balance/allowance
     * 
     * Emits an {EscrowDeployed} event.
     */
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
     * @notice Triggers destination escrow deployment on Stellar
     * @dev Emits an event that off-chain services monitor to deploy Stellar escrows
     * 
     * This function serves as a bridge between EVM and Stellar networks:
     * - Emits an event with order details
     * - Off-chain service detects the event
     * - Service deploys corresponding Stellar escrow
     * - Oracle confirms deployment via confirmStellarEscrow
     * 
     * @param orderHash The hash of the order requiring Stellar escrow deployment
     * 
     * Requirements:
     * - Caller must be the contract owner (resolver)
     * - Source escrow should already be deployed
     * 
     * Emits an {EscrowDeployed} event with address(0) indicating Stellar deployment request.
     * 
     * Note: In production, this would trigger actual Stellar escrow deployment
     * through cross-chain infrastructure.
     */
    function deployDstEscrow(bytes32 orderHash) external onlyOwner {
        // In production, this would trigger Stellar escrow deployment
        // For now, we emit an event that the off-chain service monitors
        emit EscrowDeployed(address(0), orderHash);
    }

    /**
     * @notice Withdraws funds from source escrow using the revealed atomic swap secret
     * @dev Requires prior Stellar confirmation to ensure atomic swap completion
     * 
     * This function completes the atomic swap by allowing the resolver to claim
     * the source chain funds after providing liquidity on the destination chain.
     * The Stellar confirmation requirement ensures atomicity.
     * 
     * Atomic Swap Flow:
     * 1. User reveals secret by claiming destination tokens
     * 2. Oracle detects and confirms the destination transaction
     * 3. Resolver uses the same secret to claim source tokens
     * 4. Atomic swap is complete
     * 
     * @param escrow The address of the HTLC escrow contract to withdraw from
     * @param secret The 32-byte secret that was revealed on the destination chain
     * 
     * Requirements:
     * - Stellar leg must be confirmed by oracle
     * - Secret must be correct (matches escrow hashlock)
     * - Withdrawal timelock must not be expired
     * - Escrow must have sufficient balance
     * 
     * Emits a {SecretRevealed} event.
     * 
     * Security Considerations:
     * - CRITICAL: Stellar confirmation prevents resolver from stealing funds
     * - Secret verification ensures only legitimate withdrawals
     * - Timelock prevents indefinite fund locking
     */
    function withdraw(address escrow, bytes32 secret) external {
        // Extract order hash from escrow
        bytes32 orderHash = IHTLCEscrow(escrow).orderHash();
        
        // CRITICAL: Require Stellar confirmation before allowing withdrawal
        require(stellarConfirmed[orderHash], "Stellar leg not confirmed");
        
        // Call withdraw on the HTLC escrow contract
        IHTLCEscrow(escrow).withdraw(secret);
        
        emit SecretRevealed(orderHash, secret);
    }

    /**
     * @notice Emergency withdrawal mechanism for oracle failure scenarios
     * @dev Owner-only function that bypasses Stellar confirmation requirement
     * 
     * This function provides a safety mechanism when:
     * - Oracle service is unavailable or malfunctioning
     * - Stellar network is experiencing issues
     * - Legitimate atomic swaps cannot be confirmed normally
     * 
     * Should only be used after careful verification that:
     * - The Stellar leg was actually completed
     * - Normal confirmation process has failed
     * - Sufficient time has passed for normal resolution
     * 
     * @param escrow The address of the HTLC escrow contract
     * @param secret The revealed secret from the destination chain
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - Should verify Stellar transaction independently
     * - Use only as last resort
     * 
     * Emits a {SecretRevealed} event.
     * 
     * Security Considerations:
     * - HIGH RISK: Bypasses main security mechanism
     * - Owner must manually verify destination transaction
     * - Should be used sparingly and with extreme caution
     * - Consider implementing additional timelock for extra security
     */
    function emergencyWithdraw(address escrow, bytes32 secret) external onlyOwner {
        // This allows owner to recover funds if Stellar oracle fails
        // Should only be used after careful verification
        
        IHTLCEscrow(escrow).withdraw(secret);
        
        bytes32 orderHash = IHTLCEscrow(escrow).orderHash();
        emit SecretRevealed(orderHash, secret);
    }

    /**
     * @notice Rescues tokens that are stuck in the contract
     * @dev Owner-only function for recovering accidentally sent tokens or ETH
     * 
     * This function allows recovery of:
     * - Tokens accidentally sent to the contract
     * - ETH sent to the contract
     * - Leftover tokens from failed operations
     * 
     * @param token The token contract address (use address(0) for ETH)
     * @param amount The amount of tokens/ETH to rescue
     * 
     * Requirements:
     * - Caller must be the contract owner
     * - Contract must have sufficient balance
     * - Should not interfere with active escrows
     * 
     * Security Considerations:
     * - Only for genuinely stuck/accidental tokens
     * - Should not be used to recover escrow funds
     * - Owner should verify tokens are not part of active swaps
     */
    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    /**
     * @notice Receives ETH sent to the contract
     * @dev Allows the contract to receive ETH for gas payments and escrow operations
     * 
     * This function enables:
     * - Receiving ETH for gas payments
     * - Accepting ETH from escrow operations
     * - Handling ETH-based atomic swaps
     * 
     * Security Considerations:
     * - ETH can be rescued using rescueTokens if needed
     * - No restrictions on who can send ETH
     */
    receive() external payable {}
}