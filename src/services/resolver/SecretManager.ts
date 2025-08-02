import { randomBytes, createHash } from 'crypto';
import { ethers } from 'ethers';
import { logger } from './utils/logger';

export interface SecretData {
  secret: string;
  hashedSecret: string;
  orderHash: string;
  createdAt: Date;
  revealedAt?: Date;
}

export class SecretManager {
  private secrets: Map<string, SecretData> = new Map();
  private persistentStore: Map<string, string> = new Map(); // In production, replace with Redis/DB

  /**
   * Generate a new secret with persistent storage
   */
  async newSecret(): Promise<{ secret: string; hash: string }> {
    const bytes = ethers.randomBytes(32);
    const secret = ethers.hexlify(bytes);
    const hash = ethers.keccak256(secret);
    
    console.log('🔑 NEW SECRET', secret); // Console breadcrumb for debugging
    
    // Store secret with hash as key for retrieval
    await this.persistentStore.set(`secret:${hash}`, secret);
    
    return { secret, hash };
  }

  /**
   * Generate a cryptographically secure secret for an order
   */
  async generateSecret(orderHash: string): Promise<SecretData> {
    const { secret, hash } = await this.newSecret();
    
    const secretData: SecretData = {
      secret,
      hashedSecret: hash,
      orderHash,
      createdAt: new Date(),
    };
    
    this.secrets.set(orderHash, secretData);
    logger.info(`Generated secret for order ${orderHash}`);
    
    return secretData;
  }

  /**
   * Generate multiple secrets for partial fills
   */
  generatePartialFillSecrets(orderHash: string, parts: number): SecretData[] {
    const secrets: SecretData[] = [];
    
    // Generate N+1 secrets for N parts
    for (let i = 0; i <= parts; i++) {
      const secret = '0x' + randomBytes(32).toString('hex');
      const hashedSecret = this.hashSecret(secret);
      
      const secretData: SecretData = {
        secret,
        hashedSecret,
        orderHash: `${orderHash}-part-${i}`,
        createdAt: new Date(),
      };
      
      secrets.push(secretData);
      this.secrets.set(secretData.orderHash, secretData);
    }
    
    logger.info(`Generated ${secrets.length} secrets for partial fill order ${orderHash}`);
    return secrets;
  }

  /**
   * Hash a secret using SHA256 (matching Stellar's implementation)
   */
  hashSecret(secret: string): string {
    const cleanSecret = secret.startsWith('0x') ? secret.slice(2) : secret;
    const hash = createHash('sha256').update(Buffer.from(cleanSecret, 'hex')).digest('hex');
    return '0x' + hash;
  }

  /**
   * Get stored secret for an order
   */
  async getSecret(orderHash: string): Promise<SecretData | undefined> {
    const secretData = this.secrets.get(orderHash);
    
    // If not in memory, try to recover from persistent store
    if (!secretData) {
      // This would need the hash to look up, typically stored with the order
      return undefined;
    }
    
    return secretData;
  }

  /**
   * Get secret by hash from persistent store
   */
  async getSecretByHash(hash: string): Promise<string | undefined> {
    return this.persistentStore.get(`secret:${hash}`);
  }

  /**
   * Store a revealed secret (from chain events)
   */
  storeRevealedSecret(orderHash: string, secret: string): void {
    let secretData = this.secrets.get(orderHash);
    
    if (!secretData) {
      // Secret was revealed by another resolver
      secretData = {
        secret,
        hashedSecret: this.hashSecret(secret),
        orderHash,
        createdAt: new Date(),
        revealedAt: new Date(),
      };
      this.secrets.set(orderHash, secretData);
    } else {
      secretData.revealedAt = new Date();
    }
    
    logger.info(`Stored revealed secret for order ${orderHash}`);
  }

  /**
   * Check if a secret should be revealed based on timelock
   */
  shouldRevealSecret(orderHash: string, currentTime: number, revealTime: number): boolean {
    const secretData = this.secrets.get(orderHash);
    
    if (!secretData || secretData.revealedAt) {
      return false;
    }
    
    return currentTime >= revealTime;
  }

  /**
   * Clean up old secrets
   */
  cleanup(olderThan: Date): void {
    let removed = 0;
    
    for (const [orderHash, secretData] of this.secrets.entries()) {
      if (secretData.createdAt < olderThan && secretData.revealedAt) {
        this.secrets.delete(orderHash);
        removed++;
      }
    }
    
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} old secrets`);
    }
  }

  /**
   * Build Merkle tree for partial fill secrets
   */
  buildMerkleTreeForSecrets(secrets: string[]): { root: string; proofs: Map<number, string[]> } {
    // Simple Merkle tree implementation
    // In production, use a proper Merkle tree library
    
    const leaves = secrets.map((secret, index) => {
      const data = Buffer.concat([
        Buffer.from(index.toString()),
        Buffer.from(secret.slice(2), 'hex'),
      ]);
      return createHash('keccak256').update(data).digest();
    });
    
    // Build tree and generate proofs
    const tree = this.buildMerkleTreeFromLeaves(leaves);
    const proofs = new Map<number, string[]>();
    
    // Generate proof for each leaf
    for (let i = 0; i < leaves.length; i++) {
      proofs.set(i, this.getMerkleProof(tree, i));
    }
    
    return {
      root: '0x' + tree[tree.length - 1].toString('hex'),
      proofs,
    };
  }

  /**
   * Build Merkle tree from leaves
   */
  private buildMerkleTreeFromLeaves(leaves: Buffer[]): Buffer[] {
    if (leaves.length === 0) {
      return [Buffer.alloc(32)];
    }
    
    const tree: Buffer[] = [...leaves];
    let levelSize = leaves.length;
    
    while (levelSize > 1) {
      const nextLevelSize = Math.ceil(levelSize / 2);
      
      for (let i = 0; i < nextLevelSize; i++) {
        const left = tree[tree.length - levelSize + i * 2];
        const right = i * 2 + 1 < levelSize 
          ? tree[tree.length - levelSize + i * 2 + 1]
          : left; // Duplicate last node if odd number
        
        const combined = Buffer.concat([left, right]);
        tree.push(createHash('keccak256').update(combined).digest());
      }
      
      levelSize = nextLevelSize;
    }
    
    return tree;
  }
  
  /**
   * Get Merkle proof for a leaf
   */
  private getMerkleProof(tree: Buffer[], leafIndex: number): string[] {
    const proof: string[] = [];
    let index = leafIndex;
    let levelStart = 0;
    let levelSize = Math.ceil(tree.length / 2);
    
    while (levelSize > 1) {
      const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
      
      if (siblingIndex < levelSize) {
        proof.push('0x' + tree[levelStart + siblingIndex].toString('hex'));
      }
      
      index = Math.floor(index / 2);
      levelStart += levelSize;
      levelSize = Math.ceil(levelSize / 2);
    }
    
    return proof;
  }

  /**
   * Get secret count for monitoring
   */
  getSecretCount(): { total: number; revealed: number; pending: number } {
    let revealed = 0;
    let pending = 0;
    
    for (const secretData of this.secrets.values()) {
      if (secretData.revealedAt) {
        revealed++;
      } else {
        pending++;
      }
    }
    
    return {
      total: this.secrets.size,
      revealed,
      pending,
    };
  }
}