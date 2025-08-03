import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || '0xf91b013f8cc09f57718d49c955a633842316bc38391bddeb75700a0611e4e087';

// Minimal mock LOP contract
const MOCK_LOP_BYTECODE = '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80630c5e12081461003b5780635db9ee0a14610066575b600080fd5b61004e610049366004610089565b610079565b60405161005d939291906100c2565b60405180910390f35b61004e610074366004610089565b610081565b600192915050565b600092915050565b60006020828403121561009b57600080fd5b813567ffffffffffffffff8111156100b257600080fd5b82016101008185031261007957600080fd5b92151583526001600160a01b03918216602084015260409290920135918101919091526060019056fea2646970667358221220';

async function deployMockLOP() {
  console.log('🚀 Deploying Mock LOP to Base Sepolia\n');
  
  try {
    const provider = new ethers.JsonRpcProvider('https://sepolia.base.org');
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const signerAddress = await signer.getAddress();
    
    console.log(`Deployer: ${signerAddress}`);
    
    // Deploy minimal mock LOP
    console.log('Deploying mock LOP contract...');
    
    const tx = await signer.sendTransaction({
      data: MOCK_LOP_BYTECODE,
      gasLimit: 500000
    });
    
    console.log(`Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    
    const lopAddress = receipt.contractAddress!;
    console.log(`✅ Mock LOP deployed at: ${lopAddress}`);
    
    return lopAddress;
    
  } catch (error: any) {
    console.error('❌ Deployment failed:', error.message);
    throw error;
  }
}

// Run deployment
if (require.main === module) {
  deployMockLOP()
    .then(address => {
      console.log(`\nUse this address for ResolverV2 deployment: ${address}`);
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

export { deployMockLOP };