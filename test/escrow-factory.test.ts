import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("EscrowFactory", function () {
  let escrowFactory: Contract;
  let baseEscrow: Contract;
  let owner: Signer;
  let user1: Signer;
  let user2: Signer;
  let mockToken: Contract;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    // Deploy mock ERC20 token
    const MockToken = await ethers.getContractFactory("MockERC20");
    mockToken = await MockToken.deploy("Mock USDC", "USDC", 6);
    await mockToken.waitForDeployment();

    // Mint tokens
    await mockToken.mint(await user1.getAddress(), ethers.parseUnits("1000", 6));

    // Deploy BaseEscrow implementation
    const BaseEscrow = await ethers.getContractFactory("BaseEscrow");
    baseEscrow = await BaseEscrow.deploy();
    await baseEscrow.waitForDeployment();

    // Deploy EscrowFactory
    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    escrowFactory = await EscrowFactory.deploy(await baseEscrow.getAddress());
    await escrowFactory.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct implementation address", async function () {
      expect(await escrowFactory.implementation()).to.equal(await baseEscrow.getAddress());
    });
  });

  describe("Escrow Creation", function () {
    it("Should deploy different escrows for different order hashes", async function () {
      const orderHash1 = ethers.keccak256(ethers.toUtf8Bytes("order1"));
      const orderHash2 = ethers.keccak256(ethers.toUtf8Bytes("order2"));
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret"));

      const immutables1 = {
        orderHash: orderHash1,
        hashlock: hashlock,
        maker: await user1.getAddress(),
        taker: await user2.getAddress(),
        token: await mockToken.getAddress(),
        amount: ethers.parseUnits("100", 6),
        safetyDeposit: 0,
        timelocks: 0
      };

      const immutables2 = {
        ...immutables1,
        orderHash: orderHash2
      };

      // Approve tokens
      await mockToken.connect(user1).approve(await escrowFactory.getAddress(), ethers.parseUnits("1000", 6));

      // Deploy first escrow
      const tx1 = await escrowFactory.connect(user1).deployEscrow(immutables1);
      const receipt1 = await tx1.wait();
      
      // Get escrow address from event
      const event1 = receipt1.events?.find((e: any) => e.event === "EscrowDeployed");
      const escrowAddress1 = event1?.args?.escrow;

      // Deploy second escrow
      const tx2 = await escrowFactory.connect(user1).deployEscrow(immutables2);
      const receipt2 = await tx2.wait();
      
      const event2 = receipt2.events?.find((e: any) => e.event === "EscrowDeployed");
      const escrowAddress2 = event2?.args?.escrow;

      // Verify different addresses
      expect(escrowAddress1).to.not.equal(escrowAddress2);
      expect(escrowAddress1).to.not.equal(ethers.ZeroAddress);
      expect(escrowAddress2).to.not.equal(ethers.ZeroAddress);
    });

    it("Should emit EscrowDeployed event", async function () {
      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("order"));
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes("secret"));

      const immutables = {
        orderHash: orderHash,
        hashlock: hashlock,
        maker: await user1.getAddress(),
        taker: await user2.getAddress(),
        token: await mockToken.getAddress(),
        amount: ethers.parseUnits("100", 6),
        safetyDeposit: 0,
        timelocks: 0
      };

      await mockToken.connect(user1).approve(await escrowFactory.getAddress(), ethers.parseUnits("100", 6));

      await expect(escrowFactory.connect(user1).deployEscrow(immutables))
        .to.emit(escrowFactory, "EscrowDeployed")
        .withArgs(orderHash, await escrowFactory.predictEscrow(orderHash));
    });

    it("Should predict escrow address correctly", async function () {
      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("order"));
      const predictedAddress = await escrowFactory.predictEscrow(orderHash);

      const immutables = {
        orderHash: orderHash,
        hashlock: ethers.keccak256(ethers.toUtf8Bytes("secret")),
        maker: await user1.getAddress(),
        taker: await user2.getAddress(),
        token: await mockToken.getAddress(),
        amount: ethers.parseUnits("100", 6),
        safetyDeposit: 0,
        timelocks: 0
      };

      await mockToken.connect(user1).approve(await escrowFactory.getAddress(), ethers.parseUnits("100", 6));

      const tx = await escrowFactory.connect(user1).deployEscrow(immutables);
      const receipt = await tx.wait();
      
      const event = receipt.events?.find((e: any) => e.event === "EscrowDeployed");
      const actualAddress = event?.args?.escrow;

      expect(actualAddress).to.equal(predictedAddress);
    });
  });
});

// Mock ERC20 for testing
contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        
        return true;
    }
}