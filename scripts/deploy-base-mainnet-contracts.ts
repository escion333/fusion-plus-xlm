import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Base mainnet configuration
const BASE_MAINNET_CONFIG = {
  rpc: 'https://mainnet.base.org',
  chainId: 8453,
  lopAddress: '0x111111125421ca6dc452d289314280a0f8842a65', // 1inch LOP on Base
  explorer: 'https://basescan.org'
};

// Deployment configuration
const DEPLOYMENT_CONFIG = {
  gasLimit: {
    factory: 3000000,
    resolver: 2000000
  },
  confirmations: 2
};

async function deployBaseMainnetContracts() {
  console.log('🚀 Deploying HTLC Contracts to Base Mainnet\n');
  
  try {
    // Check for private key
    const privateKey = process.env.BASE_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('No private key found. Set BASE_PRIVATE_KEY or PRIVATE_KEY in .env');
    }
    
    // Connect to Base mainnet
    const provider = new ethers.JsonRpcProvider(BASE_MAINNET_CONFIG.rpc);
    const signer = new ethers.Wallet(privateKey, provider);
    const signerAddress = await signer.getAddress();
    
    console.log(`Deployer: ${signerAddress}`);
    
    // Check network
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(BASE_MAINNET_CONFIG.chainId)) {
      throw new Error(`Wrong network. Expected Base mainnet (${BASE_MAINNET_CONFIG.chainId}), got ${network.chainId}`);
    }
    
    // Check balance
    const balance = await provider.getBalance(signerAddress);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH`);
    
    if (balance < ethers.parseEther('0.01')) {
      throw new Error('Insufficient ETH for deployment (need at least 0.01 ETH)');
    }
    
    // Get gas price
    const feeData = await provider.getFeeData();
    console.log(`Gas Price: ${ethers.formatUnits(feeData.gasPrice || 0n, 'gwei')} gwei\n`);
    
    // Load contract artifacts
    console.log('Loading contract artifacts...');
    const htlcEscrow = loadContract('HTLCEscrow');
    const htlcFactory = loadContract('HTLCEscrowFactory');
    const resolverV2 = loadContract('ResolverV2');
    
    // Deploy HTLCEscrowFactory
    console.log('📦 Deploying HTLCEscrowFactory...');
    
    const FactoryContract = new ethers.ContractFactory(
      htlcFactory.abi,
      htlcFactory.bytecode,
      signer
    );
    
    const factory = await FactoryContract.deploy({
      gasLimit: DEPLOYMENT_CONFIG.gasLimit.factory
    });
    
    console.log(`Transaction: ${factory.deploymentTransaction()?.hash}`);
    console.log('Waiting for confirmations...');
    
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    
    // Wait for confirmations
    const factoryReceipt = await factory.deploymentTransaction()?.wait(DEPLOYMENT_CONFIG.confirmations);
    
    console.log(`✅ Factory deployed at: ${factoryAddress}`);
    console.log(`   Block: ${factoryReceipt?.blockNumber}`);
    console.log(`   Gas used: ${factoryReceipt?.gasUsed.toString()}`);
    
    // Get implementation address
    const implementationAddress = await factory.implementation();
    console.log(`✅ Implementation at: ${implementationAddress}\n`);
    
    // Deploy ResolverV2
    console.log('📦 Deploying ResolverV2...');
    
    const ResolverContract = new ethers.ContractFactory(
      resolverV2.abi,
      resolverV2.bytecode,
      signer
    );
    
    // Constructor: htlcFactory, limitOrderProtocol, stellarOracle
    const stellarOracle = signerAddress; // Use deployer as oracle initially
    
    const resolver = await ResolverContract.deploy(
      factoryAddress,
      BASE_MAINNET_CONFIG.lopAddress,
      stellarOracle,
      {
        gasLimit: DEPLOYMENT_CONFIG.gasLimit.resolver
      }
    );
    
    console.log(`Transaction: ${resolver.deploymentTransaction()?.hash}`);
    console.log('Waiting for confirmations...');
    
    await resolver.waitForDeployment();
    const resolverAddress = await resolver.getAddress();
    
    const resolverReceipt = await resolver.deploymentTransaction()?.wait(DEPLOYMENT_CONFIG.confirmations);
    
    console.log(`✅ ResolverV2 deployed at: ${resolverAddress}`);
    console.log(`   Block: ${resolverReceipt?.blockNumber}`);
    console.log(`   Gas used: ${resolverReceipt?.gasUsed.toString()}\n`);
    
    // Update .env file
    console.log('📝 Updating configuration...');
    updateEnvFile({
      BASE_MAINNET_FACTORY: factoryAddress,
      BASE_MAINNET_HTLC_IMPL: implementationAddress,
      BASE_MAINNET_RESOLVER: resolverAddress,
      BASE_MAINNET_LOP: BASE_MAINNET_CONFIG.lopAddress
    });
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('BASE MAINNET DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n✅ Deployed Contracts:');
    console.log(`  HTLCEscrowFactory: ${factoryAddress}`);
    console.log(`  HTLCEscrow Implementation: ${implementationAddress}`);
    console.log(`  ResolverV2: ${resolverAddress}`);
    console.log(`  1inch LOP: ${BASE_MAINNET_CONFIG.lopAddress}`);
    
    console.log('\n📊 Deployment Cost:');
    const totalGasUsed = (factoryReceipt?.gasUsed || 0n) + (resolverReceipt?.gasUsed || 0n);
    const gasPrice = feeData.gasPrice || 0n;
    const totalCost = totalGasUsed * gasPrice;
    console.log(`  Total gas used: ${totalGasUsed.toString()}`);
    console.log(`  Total cost: ${ethers.formatEther(totalCost)} ETH`);
    
    console.log('\n🔗 Explorer Links:');
    console.log(`  Factory: ${BASE_MAINNET_CONFIG.explorer}/address/${factoryAddress}`);
    console.log(`  Resolver: ${BASE_MAINNET_CONFIG.explorer}/address/${resolverAddress}`);
    
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('  1. Verify contracts on Basescan');
    console.log('  2. Update Stellar oracle address if needed');
    console.log('  3. Test with small amounts first');
    console.log('  4. Monitor gas prices and adjust limits');
    
    return {
      factory: factoryAddress,
      implementation: implementationAddress,
      resolver: resolverAddress
    };
    
  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    throw error;
  }
}

function loadContract(name: string) {
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${artifactPath}. Run 'npx hardhat compile' first.`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode
  };
}

function updateEnvFile(updates: Record<string, string>) {
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  
  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }
  
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('✅ .env file updated');
}

// Run deployment
if (require.main === module) {
  deployBaseMainnetContracts()
    .then(result => {
      console.log('\n✅ Base mainnet deployment complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment failed');
      process.exit(1);
    });
}

export { deployBaseMainnetContracts };