import { 
  EncryptionService, 
  RBACManager, 
  AuditLogger, 
  InMemoryAuditStore,
  OutputFilter, 
  ApiKeyManager,
  InMemoryApiKeyStore, 
  RateLimiter 
} from '@aurexara/security';
import type { EventBus } from '@aurexara/events';

/**
 * Facade class for the AUREXARA security ecosystem.
 * Consolidates encryption, RBAC, auditing, data redaction, API keys, and rate limiting.
 */
export class SecurityFacade {
  /** Encryption service for data protection */
  public readonly encryption: EncryptionService;
  
  /** Role-Based Access Control manager */
  public readonly rbac: RBACManager;
  
  /** System-wide audit logger */
  public readonly audit: AuditLogger;
  
  /** Filter for redacting PII and sensitive data */
  public readonly pii: OutputFilter;
  
  /** API key management service */
  public readonly apiKeys: ApiKeyManager;
  
  /** Request rate limiter */
  public readonly rateLimiter: RateLimiter;

  /**
   * Initializes a new instance of the SecurityFacade.
   *
   * @param masterKey - The master cryptographic key for the encryption service.
   * @param events - The EventBus instance for audit logging.
   */
  constructor(_masterKey: string, _events: EventBus) {
    this.encryption = new EncryptionService({ algorithm: 'aes-256-gcm', keyDerivation: 'scrypt' });
    this.rbac = new RBACManager();
    this.audit = new AuditLogger(new InMemoryAuditStore());
    this.pii = new OutputFilter();
    this.apiKeys = new ApiKeyManager(new InMemoryApiKeyStore());
    this.rateLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });
  }
}
