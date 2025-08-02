import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

async function deployHTLCFactory() {
  console.log("🚀 Deploying HTLCEscrowFactory to Base Mainnet");
  console.log("===========================================\n");
  
  // Check environment
  if (!process.env.BASE_PRIVATE_KEY) {
    throw new Error("BASE_PRIVATE_KEY not set in .env");
  }
  
  // Connect to Base
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
  const wallet = new ethers.Wallet(process.env.BASE_PRIVATE_KEY, provider);
  
  console.log("📋 Deployment Details:");
  console.log(`  Network: Base Mainnet (${await provider.getNetwork().then(n => n.chainId)})`);
  console.log(`  Deployer: ${wallet.address}`);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.01")) {
    throw new Error("Insufficient ETH balance for deployment");
  }
  
  // Load contract artifacts
  const artifactPath = path.join(__dirname, "../artifacts/contracts/HTLCEscrowFactory.sol/HTLCEscrowFactory.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  
  // Deploy factory
  console.log("\n🏭 Deploying HTLCEscrowFactory...");
  const Factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  const gasPrice = await provider.getFeeData();
  console.log(`  Gas price: ${ethers.formatUnits(gasPrice.gasPrice || 0, "gwei")} gwei`);
  
  const factory = await Factory.deploy({
    gasPrice: gasPrice.gasPrice,
  });
  
  console.log(`  Transaction hash: ${factory.deploymentTransaction()?.hash}`);
  console.log("  Waiting for confirmation...");
  
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  
  console.log(`\n✅ HTLCEscrowFactory deployed at: ${factoryAddress}`);
  
  // Get implementation address
  const implementation = await factory.implementation();
  console.log(`  Implementation: ${implementation}`);
  
  // Save to addresses.json
  const addressesPath = path.join(__dirname, "../addresses.json");
  let addresses: any = {};
  
  if (fs.existsSync(addressesPath)) {
    addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  }
  
  addresses.base = addresses.base || {};
  addresses.base.htlcFactory = factoryAddress;
  addresses.base.htlcImplementation = implementation;
  addresses.base.deployedAt = new Date().toISOString();
  addresses.base.deployer = wallet.address;
  
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
  console.log("\n💾 Saved to addresses.json");
  
  // Create .env.local with new address
  const envLocalPath = path.join(__dirname, "../.env.local");
  const envContent = `# HTLC Factory deployed on ${new Date().toISOString()}
BASE_ESCROW_FACTORY=${factoryAddress}
`;
  
  fs.writeFileSync(envLocalPath, envContent);
  console.log("💾 Created .env.local with new factory address");
  
  console.log("\n📝 Next Steps:");
  console.log("1. Update .env with: BASE_ESCROW_FACTORY=" + factoryAddress);
  console.log("2. Verify on BaseScan: https://basescan.org/address/" + factoryAddress);
  console.log("3. Test with: npm run test:factory");
  
  return factoryAddress;
}

// Execute deployment
deployHTLCFactory()
  .then((address) => {
    console.log(`\n✅ HTLC factory deployed at ${address}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });