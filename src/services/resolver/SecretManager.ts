import { randomBytes, createHash } from 'crypto';
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

  /**
   * Generate a cryptographically secure secret for an order
   */
  generateSecret(orderHash: string): SecretData {
    const secret = '0x' + randomBytes(32).toString('hex');
    const hashedSecret = this.hashSecret(secret);
    
    const secretData: SecretData = {
      secret,
      hashedSecret,
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
  getSecret(orderHash: string): SecretData | undefined {
    return this.secrets.get(orderHash);
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
  buildMerkleTree(secrets: string[]): { root: string; proofs: Map<number, string[]> } {
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
    // TODO: Implement proper Merkle tree logic
    
    return {
      root: '0x' + createHash('keccak256').update(Buffer.concat(leaves)).digest('hex'),
      proofs: new Map(),
    };
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