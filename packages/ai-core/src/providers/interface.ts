import type { CompletionRequest } from '../types/requests.js';
import type { CompletionResponse, StreamChunk, EmbeddingResponse } from '../types/responses.js';
import type { EmbeddingRequest } from '../types/requests.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';

/** Configuration for a provider adapter. */
export interface ProviderConfig {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly organization?: string;
}

/**
 * Core AI provider interface.
 *
 * Every provider adapter (OpenAI, Anthropic, Google, etc.) implements this.
 * The ModelGateway consumes providers through this abstraction.
 *
 * Design principles:
 * - Stateless: no conversation state held between calls
 * - Normalized: provider-specific APIs are normalized to common types
 * - Error-mapped: provider errors are mapped to typed AIError subclasses
 */
export interface IAIProvider {
  /** Unique provider identifier. */
  readonly id: string;

  /** Human-readable provider name. */
  readonly name: string;

  /** List of models this provider supports. */
  readonly models: readonly ModelCapabilities[];

  /** Generate a completion (non-streaming). */
  complete(request: CompletionRequest): Promise<CompletionResponse>;

  /** Generate a streaming completion. */
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  /** Generate embeddings. */
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /** Check provider health. */
  healthCheck(): Promise<ProviderHealth>;
}
