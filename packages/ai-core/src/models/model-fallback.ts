// Model fallback chain management
/** Fallback trigger condition */
export type FallbackTrigger = 'error' | 'timeout' | 'rate_limit' | 'content_filter' | 'budget_exceeded';

/** Fallback chain configuration */
export interface FallbackChainConfig {
  readonly id: string;
  readonly name: string;
  readonly models: readonly FallbackModelConfig[];
  readonly maxAttempts: number;
  readonly enabled: boolean;
}

/** Individual model in a fallback chain */
export interface FallbackModelConfig {
  readonly modelId: string;
  readonly priority: number; // Lower = higher priority
  readonly triggers: readonly FallbackTrigger[]; // Which errors trigger fallback to this
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly conditions?: Record<string, unknown>; // Custom routing conditions
}

/** Result of a fallback chain attempt */
export interface FallbackAttemptResult {
  readonly modelId: string;
  readonly success: boolean;
  readonly trigger?: FallbackTrigger;
  readonly error?: string;
  readonly latencyMs: number;
  readonly attempt: number;
}

/** Complete fallback chain execution result */
export interface FallbackChainResult {
  readonly chainId: string;
  readonly success: boolean;
  readonly selectedModel: string;
  readonly attempts: readonly FallbackAttemptResult[];
  readonly totalLatencyMs: number;
}

/**
 * Manages model fallback chain configurations.
 */
export class ModelFallbackManager {
  private readonly chains = new Map<string, FallbackChainConfig>();

  constructor() {}

  /**
   * Registers a new fallback chain or updates an existing one.
   * 
   * @param chain - The fallback chain configuration to register.
   */
  public registerChain(chain: FallbackChainConfig): void {
    this.chains.set(chain.id, chain);
  }

  /**
   * Retrieves a fallback chain by its ID.
   * 
   * @param chainId - The ID of the fallback chain.
   * @returns The fallback chain configuration if found, undefined otherwise.
   */
  public getChain(chainId: string): FallbackChainConfig | undefined {
    return this.chains.get(chainId);
  }

  /**
   * Lists all registered fallback chains.
   * 
   * @returns A readonly array of all fallback chain configurations.
   */
  public listChains(): readonly FallbackChainConfig[] {
    return Array.from(this.chains.values());
  }

  /**
   * Enables or disables a specific fallback chain.
   * 
   * @param chainId - The ID of the fallback chain.
   * @param enabled - Whether the chain should be enabled.
   */
  public setEnabled(chainId: string, enabled: boolean): void {
    const chain = this.chains.get(chainId);
    if (chain) {
      this.chains.set(chainId, {
        ...chain,
        enabled
      });
    }
  }

  /**
   * Gets the next model to try in a chain based on the trigger.
   * Filter models by trigger, sort by priority, return model at attemptNumber index.
   * 
   * @param chainId - The ID of the fallback chain.
   * @param trigger - The error that caused fallback.
   * @param attemptNumber - The current attempt number (0-indexed).
   * @returns The next model configuration or undefined if exhausted/not found.
   */
  public getNextModel(chainId: string, trigger: FallbackTrigger, attemptNumber: number): FallbackModelConfig | undefined {
    const chain = this.chains.get(chainId);
    if (!chain || !chain.enabled) {
      return undefined;
    }

    if (attemptNumber >= chain.maxAttempts) {
      return undefined;
    }

    // Filter models that handle this trigger
    const suitableModels = chain.models.filter(m => m.triggers.includes(trigger));
    
    // Sort by priority (lower number = higher priority)
    suitableModels.sort((a, b) => a.priority - b.priority);

    // Get the model for the current attempt
    return suitableModels[attemptNumber];
  }

  /**
   * Removes a fallback chain.
   * 
   * @param chainId - The ID of the fallback chain to remove.
   * @returns True if the chain was removed, false if it didn't exist.
   */
  public removeChain(chainId: string): boolean {
    return this.chains.delete(chainId);
  }
}
