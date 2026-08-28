import type { RetryPolicy } from './types.js';

/**
 * Result of a retry operation.
 */
export interface RetryResult<T> {
  readonly result?: T;
  readonly success: boolean;
  readonly attempts: number;
  readonly totalDurationMs: number;
  readonly errors: readonly Error[];
}

/**
 * Executor for retrying asynchronous operations based on a retry policy.
 */
export class RetryExecutor {
  /**
   * Executes a given async function with retry logic based on the provided policy.
   * @param fn The function to execute.
   * @param policy The retry policy.
   * @returns A promise that resolves to a RetryResult.
   */
  public async executeWithRetry<T>(fn: () => Promise<T>, policy: RetryPolicy): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempts = 0;
    const errors: Error[] = [];

    while (attempts <= policy.maxRetries) {
      try {
        const result = await fn();
        return {
          result,
          success: true,
          attempts: attempts + 1,
          totalDurationMs: Date.now() - startTime,
          errors,
        };
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        
        if (attempts >= policy.maxRetries || !this.isRetryable(error, policy)) {
          break;
        }

        const delay = this.computeDelay(policy, attempts);
        await this.sleep(delay);
        attempts++;
      }
    }

    return {
      success: false,
      attempts: attempts + 1,
      totalDurationMs: Date.now() - startTime,
      errors,
    };
  }

  /**
   * Computes the delay before the next retry attempt based on the strategy.
   * @param policy The retry policy.
   * @param attempt The current attempt index (0-based).
   * @returns The delay in milliseconds.
   */
  private computeDelay(policy: RetryPolicy, attempt: number): number {
    let delay = policy.baseDelayMs;

    switch (policy.strategy) {
      case 'linear':
        delay = policy.baseDelayMs * (attempt + 1);
        break;
      case 'exponential':
        delay = policy.baseDelayMs * Math.pow(2, attempt);
        break;
      case 'fixed':
      default:
        delay = policy.baseDelayMs;
        break;
    }

    if (policy.maxDelayMs !== undefined && delay > policy.maxDelayMs) {
      return policy.maxDelayMs;
    }

    return delay;
  }

  /**
   * Determines if the given error should trigger a retry.
   * @param error The error encountered.
   * @param policy The retry policy.
   * @returns True if the error is retryable, false otherwise.
   */
  private isRetryable(error: Error, policy: RetryPolicy): boolean {
    if (!policy.retryableErrors || policy.retryableErrors.length === 0) {
      return true; // If not specified, default to retrying any error
    }
    
    return policy.retryableErrors.some(retryableStr => 
      error.message.includes(retryableStr) || error.name === retryableStr
    );
  }

  /**
   * Sleeps for a specified number of milliseconds.
   * @param ms The number of milliseconds to sleep.
   * @returns A promise that resolves after the timeout.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
