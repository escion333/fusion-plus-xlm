import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// 1inch contract addresses on Ethereum mainnet
const ADDRESSES = {
  escrowFactory: "0x18D410f651289BB978Fc32F90D2d7E608F4f4560",
  limitOrderProtocol: "0x111111125421cA6dc452d289314280a0f8842A65",
  settlementExtension: "0x2B2e8cDA09bBA9660dCA5cB6233787738Ad68329",
  // Common tokens
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
};

// Well-known wallets with mainnet funds (for impersonation)
const WHALE_ADDRESSES = {
  USDC: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", // Binance
  USDT: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", // Binance
  ETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  // WETH contract
  DAI: "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8",  // DAI whale
};

async function setupMainnetFork() {
  console.log("🔧 Setting up mainnet fork environment...\n");

  // Get signers
  const [deployer, user1, user2, resolver] = await ethers.getSigners();
  
  console.log("📍 Addresses:");
  console.log("Deployer:", deployer.address);
  console.log("User1:", user1.address);
  console.log("User2:", user2.address);
  console.log("Resolver:", resolver.address);
  console.log();

  // Get contract instances
  const escrowFactory = await ethers.getContractAt(
    "IEscrowFactory",
    ADDRESSES.escrowFactory
  );
  
  const limitOrderProtocol = await ethers.getContractAt(
    "ILimitOrderProtocol",
    ADDRESSES.limitOrderProtocol
  );

  console.log("📄 1inch Contracts:");
  console.log("EscrowFactory:", await escrowFactory.getAddress());
  console.log("LimitOrderProtocol:", await limitOrderProtocol.getAddress());
  console.log();

  // Fund test accounts with ETH
  console.log("💰 Funding test accounts with ETH...");
  const ethWhale = await ethers.getImpersonatedSigner(WHALE_ADDRESSES.ETH);
  
  const fundAmount = ethers.parseEther("100");
  await user1.sendTransaction({ to: ethWhale.address, value: fundAmount });
  await ethWhale.sendTransaction({ to: user1.address, value: fundAmount });
  await ethWhale.sendTransaction({ to: user2.address, value: fundAmount });
  await ethWhale.sendTransaction({ to: resolver.address, value: fundAmount });
  
  console.log("✅ Funded accounts with 100 ETH each");

  // Fund test accounts with tokens
  console.log("\n💰 Funding test accounts with tokens...");
  
  // USDC funding
  const usdcWhale = await ethers.getImpersonatedSigner(WHALE_ADDRESSES.USDC);
  const usdc = await ethers.getContractAt("IERC20", ADDRESSES.USDC);
  
  await user1.sendTransaction({ to: usdcWhale.address, value: ethers.parseEther("1") });
  
  const usdcAmount = 1000000n * 10n ** 6n; // 1M USDC (6 decimals)
  await usdc.connect(usdcWhale).transfer(user1.address, usdcAmount);
  await usdc.connect(usdcWhale).transfer(user2.address, usdcAmount);
  await usdc.connect(usdcWhale).transfer(resolver.address, usdcAmount);
  
  console.log("✅ Funded accounts with 1M USDC each");

  // USDT funding
  const usdtWhale = await ethers.getImpersonatedSigner(WHALE_ADDRESSES.USDT);
  const usdt = await ethers.getContractAt("IERC20", ADDRESSES.USDT);
  
  await user1.sendTransaction({ to: usdtWhale.address, value: ethers.parseEther("1") });
  
  const usdtAmount = 1000000n * 10n ** 6n; // 1M USDT (6 decimals)
  await usdt.connect(usdtWhale).transfer(user1.address, usdtAmount);
  await usdt.connect(usdtWhale).transfer(user2.address, usdtAmount);
  await usdt.connect(usdtWhale).transfer(resolver.address, usdtAmount);
  
  console.log("✅ Funded accounts with 1M USDT each");

  // Display balances
  console.log("\n📊 Account Balances:");
  console.log("User1:");
  console.log("  ETH:", ethers.formatEther(await ethers.provider.getBalance(user1.address)));
  console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(user1.address), 6));
  console.log("  USDT:", ethers.formatUnits(await usdt.balanceOf(user1.address), 6));
  
  console.log("\nUser2:");
  console.log("  ETH:", ethers.formatEther(await ethers.provider.getBalance(user2.address)));
  console.log("  USDC:", ethers.formatUnits(await usdc.balanceOf(user2.address), 6));
  console.log("  USDT:", ethers.formatUnits(await usdt.balanceOf(user2.address), 6));

  // Get current block info
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  
  console.log("\n⛓️ Fork Info:");
  console.log("Block Number:", blockNumber);
  console.log("Block Timestamp:", new Date(block!.timestamp * 1000).toISOString());

  // Save setup info for other scripts
  const setupInfo = {
    addresses: {
      deployer: deployer.address,
      user1: user1.address,
      user2: user2.address,
      resolver: resolver.address,
    },
    contracts: ADDRESSES,
    whales: WHALE_ADDRESSES,
    blockNumber,
    timestamp: block!.timestamp,
  };

  console.log("\n✅ Mainnet fork setup complete!");
  console.log("\n📝 Setup info:");
  console.log(JSON.stringify(setupInfo, null, 2));

  return setupInfo;
}

// Run if called directly
if (require.main === module) {
  setupMainnetFork()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { setupMainnetFork, ADDRESSES, WHALE_ADDRESSES };