import type { IAIProvider } from '../providers/interface.js';
import type { ProviderRegistryEntry } from '../types/models.js';
import { AIError } from '../errors/base.js';
import { NoAvailableProviderError } from '../errors/routing.js';

/** Result of a fallback attempt. */
export interface FallbackResult<T> {
  readonly result: T;
  readonly provider: string;
  readonly attempts: FallbackAttempt[];
}

export interface FallbackAttempt {
  readonly provider: string;
  readonly success: boolean;
  readonly error?: string;
  readonly durationMs: number;
}

/**
 * Executes an operation with automatic fallback through a chain of providers.
 */
export class FallbackChain {
  /**
   * Execute an operation, falling through providers on failure.
   * Only retries on retryable errors.
   */
  async execute<T>(
    providers: Array<{ entry: ProviderRegistryEntry; provider: IAIProvider }>,
    operation: (provider: IAIProvider) => Promise<T>,
    options?: { maxAttempts?: number }
  ): Promise<FallbackResult<T>> {
    const attempts: FallbackAttempt[] = [];
    const maxAttempts = options?.maxAttempts ?? providers.length;
    let lastError: Error | undefined;

    for (let i = 0; i < Math.min(maxAttempts, providers.length); i++) {
      const { entry, provider } = providers[i]!;
      const startTime = Date.now();

      try {
        const result = await operation(provider);
        attempts.push({ provider: entry.id, success: true, durationMs: Date.now() - startTime });
        return { result, provider: entry.id, attempts };
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        attempts.push({ provider: entry.id, success: false, error: errorMessage, durationMs });
        lastError = error instanceof Error ? error : new Error(errorMessage);

        // Don't retry on non-retryable errors
        if (error instanceof AIError && !error.retryable) {
          throw error;
        }
      }
    }

    // All providers failed
    throw new NoAvailableProviderError({
      attemptedProviders: attempts.map(a => a.provider),
      cause: lastError,
      message: 'All providers failed in fallback chain',
    });
  }
}
