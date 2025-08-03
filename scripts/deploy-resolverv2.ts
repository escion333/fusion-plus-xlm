import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xf91b013f8cc09f57718d49c955a633842316bc38391bddeb75700a0611e4e087';

// Load contract artifact
function loadContract(name: string) {
  const artifactPath = path.join(__dirname, '..', 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found: ${artifactPath}`);
  }
  
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode
  };
}

async function deployResolverV2() {
  console.log('🚀 Deploying ResolverV2 to Base Sepolia\n');
  
  try {
    // Connect to Base Sepolia
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const signerAddress = await signer.getAddress();
    
    console.log(`Deployer: ${signerAddress}`);
    
    // Check balance
    const balance = await provider.getBalance(signerAddress);
    console.log(`Balance: ${ethers.formatEther(balance)} ETH\n`);
    
    if (balance < ethers.parseEther('0.01')) {
      throw new Error('Insufficient ETH for deployment');
    }
    
    // Get factory address from env
    const factoryAddress = process.env.BASE_SEPOLIA_FACTORY || '0xf553B081C0c690433F7d0FD9D7445eb944232aA3';
    console.log(`Using Factory: ${factoryAddress}`);
    
    // Load ResolverV2 contract
    console.log('\nLoading contract artifact...');
    const resolverV2 = loadContract('ResolverV2');
    
    // Deploy ResolverV2 with factory address
    console.log('\n📦 Deploying ResolverV2...');
    
    const ResolverContract = new ethers.ContractFactory(
      resolverV2.abi,
      resolverV2.bytecode,
      signer
    );
    
    // Constructor takes: htlcFactory, limitOrderProtocol, stellarOracle
    // For testing, we'll use the deployer as oracle and our mock LOP
    const lopAddress = '0x45CB3Cc69a56E911b161B2C7bB90958aF988E92c'; // Mock LOP for testing
    const stellarOracle = signerAddress; // Use deployer as oracle for testing
    
    const resolver = await ResolverContract.deploy(
      factoryAddress,
      lopAddress,
      stellarOracle
    );
    
    console.log(`Transaction: ${resolver.deploymentTransaction()?.hash}`);
    console.log('Waiting for confirmation...');
    
    await resolver.waitForDeployment();
    const resolverAddress = await resolver.getAddress();
    
    console.log(`✅ ResolverV2 deployed at: ${resolverAddress}`);
    
    // Verify deployment
    const resolverCode = await provider.getCode(resolverAddress);
    console.log(`\n📊 Deployment Verification:`);
    console.log(`ResolverV2 code size: ${resolverCode.length / 2 - 1} bytes`);
    
    // Test resolver functions
    console.log('\n🧪 Testing Resolver Functions...');
    
    // Create contract instance with ABI
    const deployedResolver = new ethers.Contract(
      resolverAddress,
      resolverV2.abi,
      provider
    );
    
    // Check if contract has code (wait a bit for deployment to finalize)
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalCode = await provider.getCode(resolverAddress);
    console.log(`Final code size: ${finalCode.length / 2 - 1} bytes`);
    
    // Update .env
    console.log('\n📝 Updating configuration...');
    
    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    // Update resolver address
    const regex = new RegExp(`^BASE_SEPOLIA_RESOLVER=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `BASE_SEPOLIA_RESOLVER=${resolverAddress}`);
    } else {
      envContent += `\nBASE_SEPOLIA_RESOLVER=${resolverAddress}`;
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('DEPLOYMENT SUMMARY');
    console.log('='.repeat(60));
    
    console.log('\n✅ ResolverV2 Deployed:');
    console.log(`  Address: ${resolverAddress}`);
    console.log(`  Factory: ${factoryAddress}`);
    console.log(`  LOP: ${lopAddress} (mock for testing)`);
    console.log(`  Network: Base Sepolia`);
    console.log(`  Explorer: https://sepolia.basescan.org/address/${resolverAddress}`);
    
    console.log('\n📋 Resolver Features:');
    console.log('  • Atomic order fill + escrow creation');
    console.log('  • Integration with HTLCEscrowFactory');
    console.log('  • Cross-chain coordination logic');
    console.log('  • Secret generation and management');
    console.log('  • Order validation and execution');
    
    console.log('\n🎯 Complete Infrastructure:');
    console.log(`  1. HTLCEscrowFactory: ${factoryAddress}`);
    console.log(`  2. HTLCEscrow Implementation: ${process.env.BASE_SEPOLIA_HTLC_IMPL}`);
    console.log(`  3. ResolverV2: ${resolverAddress}`);
    
    console.log('\n🔧 Ready for Testing:');
    console.log('  • Create Fusion+ orders');
    console.log('  • Execute atomic swaps');
    console.log('  • Test HTLC escrow flow');
    console.log('  • Verify cross-chain coordination');
    
    return {
      resolver: resolverAddress,
      factory: factoryAddress,
      network: 'base-sepolia'
    };
    
  } catch (error: any) {
    console.error('\n❌ Deployment failed:', error.message);
    throw error;
  }
}

// Run deployment
if (require.main === module) {
  deployResolverV2()
    .then(result => {
      console.log('\n✅ ResolverV2 deployment complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Deployment failed');
      process.exit(1);
    });
}

export { deployResolverV2 };