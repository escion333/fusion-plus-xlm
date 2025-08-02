import { ethers } from "hardhat";
import * as fs from "fs";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  console.log("🚀 Deploying EscrowFactory to Base Mainnet");
  console.log("=========================================");
  console.log("");
  
  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 ETH balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.005")) {
    console.error("❌ Insufficient ETH balance. Need at least 0.005 ETH");
    process.exit(1);
  }
  
  // Step 1: Deploy BaseEscrow implementation
  console.log("\n📦 Deploying BaseEscrow implementation...");
  const BaseEscrow = await ethers.getContractFactory("BaseEscrow");
  const baseEscrow = await BaseEscrow.deploy();
  
  console.log("⏳ Waiting for deployment confirmation...");
  await baseEscrow.waitForDeployment();
  
  const baseEscrowAddress = await baseEscrow.getAddress();
  console.log("✅ BaseEscrow deployed to:", baseEscrowAddress);
  
  // Step 2: Deploy EscrowFactory
  console.log("\n📦 Deploying EscrowFactory...");
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const escrowFactory = await EscrowFactory.deploy(baseEscrowAddress);
  
  console.log("⏳ Waiting for deployment confirmation...");
  await escrowFactory.waitForDeployment();
  
  const escrowFactoryAddress = await escrowFactory.getAddress();
  console.log("✅ EscrowFactory deployed to:", escrowFactoryAddress);
  
  // Wait for confirmations
  console.log("\n⏳ Waiting for block confirmations...");
  const deployTx = escrowFactory.deploymentTransaction();
  if (deployTx) {
    await deployTx.wait(3);
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: "base",
    chainId: 8453,
    contracts: {
      baseEscrowImplementation: baseEscrowAddress,
      escrowFactory: escrowFactoryAddress
    },
    deployer: deployer.address,
    deploymentTx: deployTx?.hash || "pending",
    timestamp: new Date().toISOString()
  };
  
  // Save to file
  fs.writeFileSync(
    "base-escrow-factory-deployment.json",
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  // Update addresses.json if it exists
  const addressesPath = "addresses.json";
  let addresses: any = {};
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));
  }
  
  addresses.base = {
    ...addresses.base,
    escrowFactory: escrowFactoryAddress,
    baseEscrowImplementation: baseEscrowAddress
  };
  
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  
  console.log("\n📝 Deployment Summary:");
  console.log("====================");
  console.log("BaseEscrow Implementation:", baseEscrowAddress);
  console.log("EscrowFactory:", escrowFactoryAddress);
  console.log("");
  console.log("🔍 View on Basescan:");
  console.log(`https://basescan.org/address/${baseEscrowAddress}`);
  console.log(`https://basescan.org/address/${escrowFactoryAddress}`);
  console.log("");
  console.log("💾 Deployment info saved to base-escrow-factory-deployment.json");
  console.log("💾 Addresses updated in addresses.json");
  console.log("");
  console.log("Next steps:");
  console.log("1. Update .env with ESCROW_FACTORY_ADDRESS=" + escrowFactoryAddress);
  console.log("2. Update spec.md with the new factory address");
  console.log("3. Test escrow creation with the factory");
}

main()
  .then(() => {
    console.log("\n✅ Deployment completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });