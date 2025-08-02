import { expect } from "chai";
import { ethers } from "hardhat";
import { HTLCEscrowFactory, HTLCEscrow, IERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HTLCEscrowFactory", function () {
  let factory: HTLCEscrowFactory;
  let usdc: IERC20;
  let owner: SignerWithAddress;
  let maker: SignerWithAddress;
  let taker: SignerWithAddress;
  
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const amount = ethers.parseUnits("10", 6); // 10 USDC
  
  beforeEach(async function () {
    [owner, maker, taker] = await ethers.getSigners();
    
    // Deploy factory
    const Factory = await ethers.getContractFactory("HTLCEscrowFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
    
    // Get USDC instance
    usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
  });
  
  describe("Deployment", function () {
    it("Should deploy with correct implementation", async function () {
      const implementation = await factory.implementation();
      expect(implementation).to.not.equal(ethers.ZeroAddress);
    });
  });
  
  describe("Escrow Creation", function () {
    it("Should predict deterministic addresses", async function () {
      const orderHash = ethers.id("test-order");
      const hashlock = ethers.id("secret");
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      
      // Predict address
      const predicted = await factory.predictEscrow(orderHash);
      
      // Deploy escrow
      const immutables = {
        orderHash,
        srcToken: USDC_ADDRESS,
        srcAmount: amount,
        srcReceiver: taker.address,
        hashlock,
        timelock,
        maker: maker.address,
        taker: taker.address
      };
      
      const tx = await factory.deployEscrow(immutables);
      const receipt = await tx.wait();
      
      // Get deployed address from event
      const event = receipt?.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed?.name === "EscrowDeployed";
        } catch {
          return false;
        }
      });
      
      const deployedAddress = event ? factory.interface.parseLog(event)?.args.escrow : null;
      
      // Verify addresses match
      expect(deployedAddress).to.equal(predicted);
    });
    
    it("Should allow withdraw with correct secret", async function () {
      const secret = "0x" + "a".repeat(64);
      const hashlock = ethers.keccak256(secret);
      const orderHash = ethers.id("test-order-2");
      const timelock = Math.floor(Date.now() / 1000) + 3600;
      
      // Deploy escrow
      const immutables = {
        orderHash,
        srcToken: ethers.ZeroAddress, // ETH for simplicity
        srcAmount: ethers.parseEther("0.1"),
        srcReceiver: taker.address,
        hashlock,
        timelock,
        maker: maker.address,
        taker: taker.address
      };
      
      await factory.deployEscrow(immutables);
      const escrowAddress = await factory.predictEscrow(orderHash);
      const escrow = await ethers.getContractAt("HTLCEscrow", escrowAddress);
      
      // Deposit ETH
      await escrow.connect(maker).deposit({ value: ethers.parseEther("0.1") });
      
      // Withdraw with secret
      const balanceBefore = await ethers.provider.getBalance(taker.address);
      await escrow.connect(taker).withdraw(secret);
      const balanceAfter = await ethers.provider.getBalance(taker.address);
      
      // Check balance increased (minus gas)
      expect(balanceAfter).to.be.gt(balanceBefore);
      
      // Check escrow state
      const details = await escrow.getDetails();
      expect(details[8]).to.be.true; // withdrawn
      expect(details[10]).to.equal(secret); // revealedSecret
    });
  });
});