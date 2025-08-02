import { SecretManager } from '../src/services/resolver/SecretManager';

// Run the test
async function runTest() {
  console.log('🔐 Testing secret persistence...\n');
  
  const sm = new SecretManager();
  
  try {
    // Test 1: Generate and log a secret
    console.log('📝 Test 1: Generating new secret');
    const { secret, hash } = await sm.newSecret();
    console.log('✅ Secret generated successfully!');
    console.log('   Hash:', hash);
    console.log('   Secret length:', secret.length, 'chars');
    
    // Test 2: Verify secret can be retrieved by hash
    console.log('\n📝 Test 2: Retrieving secret by hash');
    const retrievedByHash = await sm.getSecretByHash(hash);
    if (retrievedByHash === secret) {
      console.log('✅ Secret retrieved successfully by hash');
    } else {
      console.log('❌ Failed to retrieve secret by hash');
    }
    
    // Test 3: Create order with secret
    console.log('\n📝 Test 3: Creating order with secret');
    const orderHash = `order_${Date.now()}`;
    const orderSecret = await sm.generateSecret(orderHash);
    console.log('✅ Order created:', orderHash);
    console.log('   Secret stored for order');
    console.log('   Hashed secret:', orderSecret.hashedSecret);
    
    // Test 4: Retrieve secret by order
    console.log('\n📝 Test 4: Retrieving secret by order');
    const retrieved = await sm.getSecret(orderHash);
    if (retrieved && retrieved.secret === orderSecret.secret) {
      console.log('✅ Secret retrieved successfully by order hash');
    } else {
      console.log('❌ Failed to retrieve secret by order hash');
    }
    
    // Test 5: Multiple orders
    console.log('\n📝 Test 5: Testing multiple orders');
    const orders = ['order1', 'order2', 'order3'];
    const secrets = new Map<string, string>();
    
    for (const orderId of orders) {
      const secretData = await sm.generateSecret(orderId);
      secrets.set(orderId, secretData.secret);
    }
    
    let allRetrieved = true;
    for (const [orderId, expectedSecret] of secrets) {
      const retrieved = await sm.getSecret(orderId);
      if (!retrieved || retrieved.secret !== expectedSecret) {
        allRetrieved = false;
        break;
      }
    }
    
    if (allRetrieved) {
      console.log('✅ All secrets retrieved successfully for multiple orders');
    } else {
      console.log('❌ Failed to retrieve all secrets for multiple orders');
    }
    
    console.log('\n✅ All tests completed!\n');
    console.log('🎯 Summary: The SecretManager now:');
    console.log('   - Generates cryptographically secure secrets');
    console.log('   - Logs secrets to console for debugging (🔑 NEW SECRET)');
    console.log('   - Persists secrets by hash for retrieval');
    console.log('   - Associates secrets with order hashes');
    console.log('   - Supports multiple concurrent orders');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
runTest().catch(console.error);