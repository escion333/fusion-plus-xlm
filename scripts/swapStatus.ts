import { ethers } from "ethers";
import dotenv from 'dotenv';

dotenv.config();

const ORDER_ID = "0x3459ce559a8b2d274e6fe0b127f8671ec0bce4ddb91ba0059f07641079f4a160";
const BASE_ESCROW = "0x27941FDF22BebD47448E198ABba5BB594D4aB2F0";
const STELLAR_HTLC = "CALNCI5AP4VEAEQSIAOK3G6FXMKXB4JZLZ6W5TZE44QP4ACVO7BJLS6I";
const SECRET = "20031fdba07e7f8d815e309e14b3096c679ee37e7728a3d87e875b088df27931";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function checkSwapStatus() {
  console.log('📊 5 USDC Cross-Chain Swap Status');
  console.log('=================================');
  
  const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
  
  // Check Base escrow balance
  const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
  const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
  const escrowBalance = await usdc.balanceOf(BASE_ESCROW);
  
  console.log(`\n💰 Base Escrow Status:`);
  console.log(`   Address: ${BASE_ESCROW}`);
  console.log(`   USDC Balance: ${ethers.formatUnits(escrowBalance, 6)} USDC`);
  console.log(`   Status: ${escrowBalance >= ethers.parseUnits("5", 6) ? "✅ Funded" : "❌ Not funded"}`);
  console.log(`   Explorer: https://basescan.org/address/${BASE_ESCROW}`);
  
  console.log(`\n🌟 Stellar HTLC Status:`);
  console.log(`   Address: ${STELLAR_HTLC}`);
  console.log(`   Status: ⏳ Awaiting resolver funding`);
  console.log(`   Explorer: https://stellar.expert/explorer/public/contract/${STELLAR_HTLC}`);
  
  console.log(`\n🔑 Withdrawal Info:`);
  console.log(`   Secret: ${SECRET}`);
  console.log(`   User: GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4`);
  
  console.log(`\n📋 Current Status:`);
  console.log(`   1. ✅ Order created: ${ORDER_ID}`);
  console.log(`   2. ✅ Base escrow funded with 5 USDC`);
  console.log(`   3. ⏳ Resolver needs to fund Stellar HTLC`);
  console.log(`   4. ⏳ User withdraws from Stellar HTLC`);
  console.log(`   5. ⏳ Resolver withdraws from Base escrow`);
  
  console.log(`\n🚀 Next Steps:`);
  console.log(`   1. Fund Stellar HTLC (resolver action)`);
  console.log(`   2. User runs withdrawal command:`);
  console.log(`      stellar contract invoke --id ${STELLAR_HTLC} --source-account GDIY6AQQ75WMD4W46EYB7O6UYMHOCGQHLAQGQTKHDX4J2DYQCHVCR4W4 -- withdraw --secret ${SECRET}`);
  
  // Check order status from resolver
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`http://localhost:3003/api/orders/${ORDER_ID}`);
    const orderData = await response.json();
    
    console.log(`\n🔍 Resolver Order Status:`);
    console.log(`   Status: ${orderData.order?.status || 'unknown'}`);
    console.log(`   Source: ${orderData.source || 'unknown'}`);
  } catch (error) {
    console.log(`\n⚠️  Extended resolver not responding`);
  }
}

checkSwapStatus().catch(console.error);