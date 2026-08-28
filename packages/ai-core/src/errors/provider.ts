import { AIError } from './base.js';

/** General provider failure. */
export class ProviderError extends AIError {
  constructor(params: { message: string; provider?: string; model?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'PROVIDER_ERROR', retryable: true });
    this.name = 'ProviderError';
  }
}

/** Rate limit error (e.g., HTTP 429). */
export class RateLimitError extends AIError {
  public readonly retryAfterMs?: number;

  constructor(params: { message: string; retryAfterMs?: number; provider?: string; model?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'RATE_LIMIT', retryable: true });
    this.name = 'RateLimitError';
    this.retryAfterMs = params.retryAfterMs;
  }
}

/** Authentication or authorization error. */
export class AuthenticationError extends AIError {
  constructor(params: { message: string; provider?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'AUTHENTICATION_ERROR', retryable: false });
    this.name = 'AuthenticationError';
  }
}

/** Request timeout error. */
export class TimeoutError extends AIError {
  public readonly timeoutMs?: number;

  constructor(params: { message: string; timeoutMs?: number; provider?: string; model?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'TIMEOUT', retryable: true });
    this.name = 'TimeoutError';
    this.timeoutMs = params.timeoutMs;
  }
}

/** Content filtered by provider moderation policies. */
export class ContentFilteredError extends AIError {
  constructor(params: { message: string; provider?: string; model?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'CONTENT_FILTERED', retryable: false });
    this.name = 'ContentFilteredError';
  }
}

/** Context length or token limit exceeded. */
export class ContextLengthExceededError extends AIError {
  public readonly maxTokens?: number;
  public readonly requestedTokens?: number;

  constructor(params: { message: string; maxTokens?: number; requestedTokens?: number; provider?: string; model?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'CONTEXT_LENGTH_EXCEEDED', retryable: false });
    this.name = 'ContextLengthExceededError';
    this.maxTokens = params.maxTokens;
    this.requestedTokens = params.requestedTokens;
  }
}
