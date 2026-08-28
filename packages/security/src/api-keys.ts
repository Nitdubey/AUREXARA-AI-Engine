import { randomUUID, createHash, randomBytes } from 'node:crypto';
import type { Permission } from './types.js';

/** API Key metadata */
export interface ApiKey {
  readonly id: string;
  readonly name: string;
  readonly keyHash: string;
  readonly prefix: string;
  readonly tenantId: string;
  readonly permissions: readonly Permission[];
  readonly createdAt: Date;
  readonly expiresAt?: Date;
  readonly lastUsedAt?: Date;
  readonly isRevoked: boolean;
}

/** Result of API key validation */
export interface ApiKeyValidation {
  readonly valid: boolean;
  readonly key?: ApiKey;
  readonly reason?: string;
}

/** Interface for API key storage */
export interface ApiKeyStore {
  save(key: ApiKey): Promise<void>;
  findById(keyId: string): Promise<ApiKey | undefined>;
  findByHash(keyHash: string): Promise<ApiKey | undefined>;
  findByTenant(tenantId: string): Promise<readonly ApiKey[]>;
  revoke(keyId: string): Promise<void>;
  updateLastUsed(keyId: string, timestamp: Date): Promise<void>;
}

/** In-memory implementation of ApiKeyStore */
export class InMemoryApiKeyStore implements ApiKeyStore {
  private readonly store = new Map<string, ApiKey>();

  /**
   * Save an API key to the store.
   * @param key The API key to save
   */
  public async save(key: ApiKey): Promise<void> {
    this.store.set(key.id, key);
  }

  /**
   * Find an API key by its unique ID.
   * @param keyId The ID of the key to find
   * @returns The API key if found, otherwise undefined
   */
  public async findById(keyId: string): Promise<ApiKey | undefined> {
    return this.store.get(keyId);
  }

  /**
   * Find an API key by its SHA-256 hash.
   * @param keyHash The SHA-256 hash of the API key
   * @returns The API key if found, otherwise undefined
   */
  public async findByHash(keyHash: string): Promise<ApiKey | undefined> {
    for (const key of this.store.values()) {
      if (key.keyHash === keyHash) {
        return key;
      }
    }
    return undefined;
  }

  /**
   * Find all API keys for a given tenant.
   * @param tenantId The ID of the tenant
   * @returns A read-only array of API keys belonging to the tenant
   */
  public async findByTenant(tenantId: string): Promise<readonly ApiKey[]> {
    const keys: ApiKey[] = [];
    for (const key of this.store.values()) {
      if (key.tenantId === tenantId) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Revoke an API key by its ID.
   * @param keyId The ID of the key to revoke
   */
  public async revoke(keyId: string): Promise<void> {
    const key = this.store.get(keyId);
    if (key) {
      this.store.set(keyId, { ...key, isRevoked: true });
    }
  }

  /**
   * Update the last used timestamp of an API key.
   * @param keyId The ID of the key to update
   * @param timestamp The timestamp of the last usage
   */
  public async updateLastUsed(keyId: string, timestamp: Date): Promise<void> {
    const key = this.store.get(keyId);
    if (key) {
      this.store.set(keyId, { ...key, lastUsedAt: timestamp });
    }
  }
}

/**
 * Manages API key lifecycle: generation, validation, rotation, revocation.
 */
export class ApiKeyManager {
  /**
   * Construct a new ApiKeyManager.
   * @param store The underlying API key storage
   */
  constructor(private readonly store: ApiKeyStore) {}

  /**
   * Generate a new API key.
   * Returns the raw key (only shown once) and the stored ApiKey metadata.
   * Key format: 'aurx_pk_' + 32 random hex chars
   *
   * @param name The name given to the key
   * @param tenantId The ID of the tenant
   * @param permissions The permissions assigned to the key
   * @param expiresAt The optional expiration date for the key
   * @returns The raw key and the stored API key metadata
   */
  public async generateKey(
    name: string,
    tenantId: string,
    permissions: readonly Permission[],
    expiresAt?: Date
  ): Promise<{ rawKey: string; apiKey: ApiKey }> {
    const randomHex = randomBytes(16).toString('hex');
    const rawKey = `aurx_pk_${randomHex}`;
    const apiKey: ApiKey = {
      id: randomUUID(),
      name,
      keyHash: this.hashKey(rawKey),
      prefix: rawKey.substring(0, 16),
      tenantId,
      permissions,
      createdAt: new Date(),
      expiresAt,
      isRevoked: false,
    };
    await this.store.save(apiKey);
    return { rawKey, apiKey };
  }

  /**
   * Validate an API key.
   * Hash the provided key, look up in store, check revocation and expiry.
   *
   * @param rawKey The raw API key string to validate
   * @returns The validation result including the key metadata if valid
   */
  public async validateKey(rawKey: string): Promise<ApiKeyValidation> {
    try {
      const hash = this.hashKey(rawKey);
      const key = await this.store.findByHash(hash);

      if (!key) {
        return { valid: false, reason: 'Key not found' };
      }

      if (key.isRevoked) {
        return { valid: false, key, reason: 'Key revoked' };
      }

      if (key.expiresAt && key.expiresAt < new Date()) {
        return { valid: false, key, reason: 'Key expired' };
      }

      await this.store.updateLastUsed(key.id, new Date());
      return { valid: true, key };
    } catch (error) {
      return { valid: false, reason: 'Validation failed' };
    }
  }

  /**
   * Revoke an API key.
   *
   * @param keyId The ID of the key to revoke
   */
  public async revokeKey(keyId: string): Promise<void> {
    await this.store.revoke(keyId);
  }

  /**
   * Rotate a key: revoke old one, generate new one with same permissions.
   *
   * @param keyId The ID of the key to rotate
   * @returns The new raw key and stored API key metadata, or undefined if not found
   */
  public async rotateKey(keyId: string): Promise<{ rawKey: string; apiKey: ApiKey } | undefined> {
    const keyToRotate = await this.store.findById(keyId);
    if (!keyToRotate) {
      return undefined;
    }

    await this.revokeKey(keyId);
    return this.generateKey(keyToRotate.name, keyToRotate.tenantId, keyToRotate.permissions, keyToRotate.expiresAt);
  }

  /**
   * List all keys for a tenant.
   *
   * @param tenantId The ID of the tenant
   * @returns A read-only array of API keys
   */
  public async listKeys(tenantId: string): Promise<readonly ApiKey[]> {
    return this.store.findByTenant(tenantId);
  }

  /**
   * Hash a raw key with SHA-256
   *
   * @param rawKey The raw key string to hash
   * @returns The SHA-256 hash of the key
   */
  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
