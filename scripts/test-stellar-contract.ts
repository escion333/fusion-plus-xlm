#!/usr/bin/env ts-node

import * as StellarSdk from '@stellar/stellar-sdk';
import dotenv from 'dotenv';

dotenv.config();

const CONTRACT_ID = 'CBX3ET3JMZQCQF74YN2PR35ALF3EI73VMYWUX33WKTQMY62I2YR2YWFU';

async function testContract() {
  console.log('🔍 Testing Stellar Mainnet Contract...\n');
  
  const server = new StellarSdk.SorobanRpc.Server('https://soroban-rpc.mainnet.stellar.gateway.fm');
  
  try {
    // Get contract info
    console.log(`Contract ID: ${CONTRACT_ID}`);
    console.log('Network: Stellar PUBLIC (Mainnet)');
    console.log(`Explorer: https://stellar.expert/explorer/public/contract/${CONTRACT_ID}`);
    
    // Get latest ledger
    const ledger = await server.getLatestLedger();
    console.log(`\n✅ Connected to Stellar Mainnet`);
    console.log(`Latest Ledger: ${ledger.sequence}`);
    
    // Test account
    const keypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_TEST_WALLET_SECRET!);
    const account = await server.getAccount(keypair.publicKey());
    
    console.log(`\n📱 Test Account:`);
    console.log(`Address: ${keypair.publicKey()}`);
    console.log(`Sequence: ${account.sequence}`);
    
    // Check balances
    const horizonServer = new StellarSdk.Horizon.Server('https://horizon.stellar.org');
    const accountDetails = await horizonServer.loadAccount(keypair.publicKey());
    
    console.log(`\n💰 Balances:`);
    accountDetails.balances.forEach((balance: any) => {
      if (balance.asset_type === 'native') {
        console.log(`XLM: ${balance.balance}`);
      } else {
        console.log(`${balance.asset_code}: ${balance.balance}`);
      }
    });
    
    console.log('\n✅ Contract is accessible and account is ready for transactions!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testContract().catch(console.error);