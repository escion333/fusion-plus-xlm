import { expect } from "chai";
import { ethers } from "hardhat";

describe("HTLCEscrowFactory Simple", function () {
  it("Should compile and deploy", async function () {
    const Factory = await ethers.getContractFactory("HTLCEscrowFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    
    const implementation = await factory.implementation();
    expect(implementation).to.not.equal(ethers.ZeroAddress);
    console.log("✅ Factory deployed with implementation:", implementation);
  });
});