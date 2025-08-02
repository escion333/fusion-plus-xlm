import { randomBytes, createHash } from "crypto";
import { ethers } from "ethers";
import * as StellarSdk from "stellar-sdk";
import { StellarFactoryService } from "../src/services/stellar/factory-service";
import { SecretManager } from "../src/services/resolver/SecretManager";
import dotenv from "dotenv";

dotenv.config();

async function smokeStellar() {
  console.log("🚀 Stellar Factory Smoke Test");
  console.log("==============================\n");

  // Initialize services
  const network = process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
  const factoryService = new StellarFactoryService(network);
  const secretManager = new SecretManager();
  
  // Generate test parameters WITH PERSISTENCE
  const orderHash = randomBytes(32).toString("hex");
  
  // USE SECRETMANAGER FOR PERSISTENCE!
  const { secret: secretHex } = await secretManager.newSecret();
  const secret = secretHex.slice(2); // Remove 0x prefix
  
  // USE SHA256 FOR STELLAR (not Keccak256!)
  const secretHash = createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
  console.log("🔐 Using SHA256 for Stellar compatibility");
  
  // Also associate with order for retrieval
  await secretManager.generateSecret(orderHash);
  
  console.log("🔑 Secret generated and PERSISTED!");
  console.log(`   Secret: 0x${secret}`);
  console.log(`   Hash: 0x${secretHash}`);
  
  // Test addresses
  const maker = process.env.DEMO_STELLAR_USER || "GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4";
  const taker = process.env.DEMO_STELLAR_RESOLVER || "GCTMFTL6HLLA2KH5GKIQ5MGOMRR5ZRJCBZD4HFNWJEQEHPE6TCDG5TSF";
  const token = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"; // Stellar USDC
  
  const params = {
    orderHash,
    hashlock: secretHash,
    maker,
    taker,
    token,
    amount: "10000000", // 1 USDC (proper amount with 7 decimals)
    safetyDeposit: "1000000", // 0.1 USDC safety deposit
    timelocks: (Math.floor(Date.now() / 1000) + 3600).toString(), // 1 hour from now
  };
  
  console.log("📋 Test Parameters:");
  console.log(`  Order Hash: ${orderHash}`);
  console.log(`  Secret Hash: ${secretHash}`);
  console.log(`  Maker: ${maker}`);
  console.log(`  Taker: ${taker}`);
  console.log(`  Token: ${token}`);
  console.log(`  Amount: ${params.amount} stroops`);
  console.log(`  Network: ${network}`);
  console.log();
  
  try {
    // Step 1: Calculate escrow address
    console.log("🔮 Calculating escrow address...");
    const calculatedAddress = await factoryService.calculateEscrowAddress(params);
    console.log(`✅ Calculated address: ${calculatedAddress}`);
    console.log();
    
    // Step 2: Deploy escrow (requires funded deployer keypair)
    const deployerSecret = process.env.STELLAR_DEPLOYER_SECRET || process.env.STELLAR_TEST_WALLET_SECRET;
    if (!deployerSecret) {
      console.log("⚠️  No deployer secret found. Skipping deployment.");
      console.log("   Set STELLAR_DEPLOYER_SECRET to deploy escrows.");
      return;
    }
    
    const deployerKeypair = StellarSdk.Keypair.fromSecret(deployerSecret);
    console.log(`🔑 Deployer: ${deployerKeypair.publicKey()}`);
    
    console.log("\n🚀 Deploying escrow contract...");
    const deployedAddress = await factoryService.deployEscrow({
      ...params,
      sourceKeypair: deployerKeypair
    });
    
    console.log(`✅ Deployed at: ${deployedAddress}`);
    
    if (deployedAddress === calculatedAddress) {
      console.log("✅ Addresses match! Deterministic deployment successful.");
    } else {
      console.log("⚠️  Address mismatch!");
      console.log(`   Expected: ${calculatedAddress}`);
      console.log(`   Got: ${deployedAddress}`);
    }
    
    console.log("\n📍 View on Stellar Expert:");
    console.log(`   https://stellar.expert/explorer/${network === "mainnet" ? "public" : "testnet"}/contract/${deployedAddress}`);
    
    // SAVE SWAP DETAILS FOR WITHDRAWAL
    const swapData = {
      escrowAddress: deployedAddress,
      secret: secretHex,
      secretHash: `0x${secretHash}`,
      orderHash,
      maker,
      taker,
      token,
      amount: params.amount,
      network,
      timestamp: new Date().toISOString(),
      withdrawCommand: `stellar contract invoke --id ${deployedAddress} --source-account ${taker} --network ${network === "mainnet" ? "public" : "testnet"} -- withdraw --secret ${secret}`
    };
    
    const fs = require('fs').promises;
    const filename = `smoke-test-${Date.now()}.json`;
    await fs.writeFile(filename, JSON.stringify(swapData, null, 2));
    
    console.log("\n💾 Swap details saved to:", filename);
    console.log("\n🔓 TO WITHDRAW THE FUNDS:");
    console.log("   " + swapData.withdrawCommand);
    
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:", error.stack);
    }
  }
}

// Run the test
smokeStellar().catch(console.error);