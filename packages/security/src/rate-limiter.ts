/** Rate limit configuration */
export interface RateLimitConfig {
  readonly maxRequests: number;
  readonly windowMs: number;
}

/** Result of a rate limit check */
export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: Date;
  readonly retryAfterMs?: number;
}

/** Rate limit entry (internal) */
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

/**
 * Sliding window rate limiter with per-key limits.
 * Keys can be tenantId, userId, or tenantId:endpoint combos.
 */
export class RateLimiter {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly config: RateLimitConfig;

  /**
   * Construct a new RateLimiter.
   * @param config The rate limit configuration
   */
  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check and consume a rate limit token.
   * @param key The rate limit key (e.g. tenantId, userId, endpoint)
   * @returns The result of the rate limit check
   */
  public check(key: string): RateLimitResult {
    const now = Date.now();
    let entry = this.limits.get(key);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      entry = { count: 0, windowStart: now };
      this.limits.set(key, entry);
    }

    const resetAt = new Date(entry.windowStart + this.config.windowMs);

    if (entry.count < this.config.maxRequests) {
      entry.count++;
      return {
        allowed: true,
        remaining: this.config.maxRequests - entry.count,
        resetAt,
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfterMs: resetAt.getTime() - now,
    };
  }

  /**
   * Get current limit status without consuming a token.
   * @param key The rate limit key
   * @returns The current status of the rate limit
   */
  public peek(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
      };
    }

    const resetAt = new Date(entry.windowStart + this.config.windowMs);

    return {
      allowed: entry.count < this.config.maxRequests,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetAt,
      retryAfterMs: entry.count >= this.config.maxRequests ? resetAt.getTime() - now : undefined,
    };
  }

  /**
   * Reset limits for a specific key.
   * @param key The rate limit key to reset
   */
  public reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Reset all limits.
   */
  public resetAll(): void {
    this.limits.clear();
  }
}

/**
 * Tiered rate limiter with multiple limit tiers.
 * E.g. 100 req/min AND 1000 req/hour.
 */
export class TieredRateLimiter {
  private readonly tiers: RateLimiter[];

  /**
   * Construct a new TieredRateLimiter.
   * @param configs Array of rate limit configurations
   */
  constructor(configs: readonly RateLimitConfig[]) {
    this.tiers = configs.map(c => new RateLimiter(c));
  }

  /**
   * Check all tiers. Denied if ANY tier is exceeded.
   * Will only consume tokens if all tiers allow the request.
   *
   * @param key The rate limit key
   * @returns The most restrictive allowed result, or the first denied result
   */
  public check(key: string): RateLimitResult {
    // First peek all tiers to ensure we don't partially consume
    for (const tier of this.tiers) {
      const result = tier.peek(key);
      if (!result.allowed) {
        return result;
      }
    }

    let minRemaining = Number.MAX_SAFE_INTEGER;
    let mostRestrictiveResult: RateLimitResult | undefined = undefined;

    // Now consume tokens across all tiers
    for (const tier of this.tiers) {
      const result = tier.check(key);
      if (result.remaining < minRemaining) {
        minRemaining = result.remaining;
        mostRestrictiveResult = result;
      }
    }

    return mostRestrictiveResult || {
      allowed: true,
      remaining: 0,
      resetAt: new Date(),
    };
  }

  /**
   * Reset limits for a specific key across all tiers.
   * @param key The rate limit key
   */
  public reset(key: string): void {
    for (const tier of this.tiers) {
      tier.reset(key);
    }
  }

  /**
   * Reset all limits across all tiers.
   */
  public resetAll(): void {
    for (const tier of this.tiers) {
      tier.resetAll();
    }
  }
}
