import { createCipheriv, createDecipheriv, randomBytes, createHash, scryptSync, type CipherGCM, type DecipherGCM } from 'node:crypto';

/** Encryption configuration */
export interface EncryptionConfig {
  readonly algorithm: 'aes-256-gcm' | 'aes-256-cbc';
  readonly keyDerivation: 'scrypt';
}

/** Encrypted payload */
export interface EncryptedPayload {
  readonly ciphertext: string;  // base64
  readonly iv: string;          // base64
  readonly authTag?: string;    // base64 (for GCM)
  readonly algorithm: string;
}

/**
 * Symmetric encryption service for data-at-rest protection.
 */
export class EncryptionService {
  private readonly config: EncryptionConfig;

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = {
      algorithm: config?.algorithm ?? 'aes-256-gcm',
      keyDerivation: config?.keyDerivation ?? 'scrypt',
    };
  }

  /**
   * Derive an encryption key from a password/secret.
   * Uses scrypt for key derivation.
   * @param secret The secret password or key material
   * @param salt Optional base64 salt
   * @returns The derived key and base64 salt
   */
  deriveKey(secret: string, salt?: string): { key: Buffer; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'base64') : randomBytes(16);
    const key = scryptSync(secret, saltBuffer, 32);
    return { key, salt: saltBuffer.toString('base64') };
  }

  /**
   * Encrypt plaintext with a derived key.
   * @param plaintext The text to encrypt
   * @param key The symmetric key
   * @returns The encrypted payload
   */
  encrypt(plaintext: string, key: Buffer): EncryptedPayload {
    const ivLength = this.config.algorithm === 'aes-256-gcm' ? 12 : 16;
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(this.config.algorithm, key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    const payload: EncryptedPayload = {
      ciphertext,
      iv: iv.toString('base64'),
      algorithm: this.config.algorithm,
    };

    if (this.config.algorithm === 'aes-256-gcm') {
      const gcmCipher = cipher as CipherGCM;
      return {
        ...payload,
        authTag: gcmCipher.getAuthTag().toString('base64'),
      };
    }

    return payload;
  }

  /**
   * Decrypt an encrypted payload.
   * @param payload The payload to decrypt
   * @param key The symmetric key
   * @returns The decrypted plaintext
   */
  decrypt(payload: EncryptedPayload, key: Buffer): string {
    const iv = Buffer.from(payload.iv, 'base64');
    const decipher = createDecipheriv(payload.algorithm, key, iv);

    if (payload.algorithm === 'aes-256-gcm' && payload.authTag) {
      const gcmDecipher = decipher as DecipherGCM;
      gcmDecipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    }

    let decrypted = decipher.update(payload.ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Hash sensitive data (one-way) for comparison.
   * @param data The data to hash
   * @returns The sha256 hex hash
   */
  hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }
}
