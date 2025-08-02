import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import crypto from "crypto";

describe("HTLC Escrow Proper Flow", function () {
  let owner: Signer;
  let taker: Signer;
  let factory: Contract;
  let escrow: Contract;
  let usdc: Contract;
  
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const amount = ethers.parseUnits("5", 6); // 5 USDC
  
  beforeEach(async function () {
    [owner, taker] = await ethers.getSigners();
    
    // Deploy factory
    const Factory = await ethers.getContractFactory("HTLCEscrowFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
    
    // Get USDC contract with fully qualified name
    usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);
    
    // Fund owner with USDC (would need to fork mainnet or use mock)
    // For testing, we'll assume owner has USDC
  });
  
  describe("Critical: Direct Transfer Protection", function () {
    it("should NOT allow direct token transfers to escrow", async function () {
      // Deploy escrow
      const salt = ethers.randomBytes(32);
      const tx = await factory.deployEscrow(salt);
      const receipt = await tx.wait();
      
      // Get escrow address from event
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === factory.interface.getEvent("EscrowDeployed").topicHash
      );
      const escrowAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"], 
        event.topics[1]
      )[0];
      
      escrow = await ethers.getContractAt("HTLCEscrow", escrowAddress);
      
      // Attempt direct transfer (this should fail or leave funds stranded)
      // In a properly designed contract, this should revert
      await expect(
        usdc.transfer(escrowAddress, amount)
      ).to.be.revertedWith("Direct transfers not allowed");
    });
  });
  
  describe("Correct: Proper Initialization Flow", function () {
    let secret: Buffer;
    let hashlock: string;
    let timelock: number;
    
    beforeEach(async function () {
      // Generate secret and hashlock
      secret = crypto.randomBytes(32);
      hashlock = ethers.keccak256(secret);
      timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      
      // Deploy escrow
      const salt = ethers.randomBytes(32);
      const tx = await factory.deployEscrow(salt);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === factory.interface.getEvent("EscrowDeployed").topicHash
      );
      const escrowAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"], 
        event.topics[1]
      )[0];
      
      escrow = await ethers.getContractAt("HTLCEscrow", escrowAddress);
    });
    
    it("should follow the correct initialization flow", async function () {
      // Step 1: Verify initial state
      expect(await escrow.deposited()).to.be.false;
      
      // Step 2: Initialize escrow
      const initParams = {
        orderHash: ethers.randomBytes(32),
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: await taker.getAddress(),
        hashlock: hashlock,
        timelock: timelock,
        maker: await owner.getAddress(),
        taker: await taker.getAddress()
      };
      
      await expect(escrow.initialize(initParams))
        .to.emit(escrow, "Initialized");
      
      // Verify parameters were set
      expect(await escrow.srcToken()).to.equal(USDC_ADDRESS);
      expect(await escrow.srcAmount()).to.equal(amount);
      expect(await escrow.hashlock()).to.equal(hashlock);
      
      // Step 3: Approve tokens
      await usdc.approve(await escrow.getAddress(), amount);
      
      // Step 4: Deposit tokens
      await expect(escrow.deposit())
        .to.emit(escrow, "Deposited")
        .withArgs(await owner.getAddress(), amount);
      
      // Verify final state
      expect(await escrow.deposited()).to.be.true;
      expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(amount);
    });
    
    it("should not allow deposit before initialization", async function () {
      await expect(escrow.deposit())
        .to.be.revertedWith("Not initialized");
    });
    
    it("should not allow double initialization", async function () {
      const initParams = {
        orderHash: ethers.randomBytes(32),
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: await taker.getAddress(),
        hashlock: hashlock,
        timelock: timelock,
        maker: await owner.getAddress(),
        taker: await taker.getAddress()
      };
      
      await escrow.initialize(initParams);
      
      await expect(escrow.initialize(initParams))
        .to.be.revertedWith("Already initialized");
    });
    
    it("should not allow double deposit", async function () {
      // Initialize
      const initParams = {
        orderHash: ethers.randomBytes(32),
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: await taker.getAddress(),
        hashlock: hashlock,
        timelock: timelock,
        maker: await owner.getAddress(),
        taker: await taker.getAddress()
      };
      
      await escrow.initialize(initParams);
      await usdc.approve(await escrow.getAddress(), amount);
      await escrow.deposit();
      
      // Try to deposit again
      await expect(escrow.deposit())
        .to.be.revertedWith("Already deposited");
    });
    
    it("should complete full swap flow", async function () {
      // Initialize and deposit
      const initParams = {
        orderHash: ethers.randomBytes(32),
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: await taker.getAddress(),
        hashlock: hashlock,
        timelock: timelock,
        maker: await owner.getAddress(),
        taker: await taker.getAddress()
      };
      
      await escrow.initialize(initParams);
      await usdc.approve(await escrow.getAddress(), amount);
      await escrow.deposit();
      
      // Taker withdraws with secret
      await expect(escrow.connect(taker).withdraw(secret))
        .to.emit(escrow, "Withdrawn")
        .withArgs(await taker.getAddress(), secret);
      
      // Verify final state
      expect(await escrow.withdrawn()).to.be.true;
      expect(await escrow.revealedSecret()).to.equal(ethers.hexlify(secret));
    });
  });
  
  describe("Edge Cases", function () {
    it("should handle refund after timelock expiry", async function () {
      const secret = crypto.randomBytes(32);
      const hashlock = ethers.keccak256(secret);
      const timelock = Math.floor(Date.now() / 1000) + 1; // 1 second
      
      // Deploy and initialize
      const salt = ethers.randomBytes(32);
      const tx = await factory.deployEscrow(salt);
      const receipt = await tx.wait();
      
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === factory.interface.getEvent("EscrowDeployed").topicHash
      );
      const escrowAddress = ethers.AbiCoder.defaultAbiCoder().decode(
        ["address"], 
        event.topics[1]
      )[0];
      
      escrow = await ethers.getContractAt("HTLCEscrow", escrowAddress);
      
      const initParams = {
        orderHash: ethers.randomBytes(32),
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: await taker.getAddress(),
        hashlock: hashlock,
        timelock: timelock,
        maker: await owner.getAddress(),
        taker: await taker.getAddress()
      };
      
      await escrow.initialize(initParams);
      await usdc.approve(await escrow.getAddress(), amount);
      await escrow.deposit();
      
      // Wait for timelock to expire
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);
      
      // Maker can refund
      await expect(escrow.refund())
        .to.emit(escrow, "Refunded")
        .withArgs(await owner.getAddress());
      
      expect(await escrow.refunded()).to.be.true;
    });
  });
});

describe("Direct Transfer Bug Prevention", function () {
  it("should document the correct pattern", async function () {
    console.log("\n✅ CORRECT ESCROW FLOW:");
    console.log("1. Deploy escrow from factory");
    console.log("2. Call escrow.initialize(params)");
    console.log("3. Call token.approve(escrow, amount)");
    console.log("4. Call escrow.deposit()");
    console.log("5. Verify escrow.deposited() == true");
    console.log("\n❌ NEVER DO THIS:");
    console.log("- token.transfer(escrowAddress, amount)");
    console.log("This will strand your funds permanently!");
  });
});