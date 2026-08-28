import type { CompletionRequest } from '../types/requests.js';
import type { CompletionResponse, EmbeddingResponse } from '../types/responses.js';
import type { EmbeddingRequest } from '../types/requests.js';
import type { ProviderRegistryEntry } from '../types/models.js';
import type { IAIProvider } from '../providers/interface.js';
import { ProviderRegistry } from './registry.js';
import { ModelRouter } from './router.js';
import { FallbackChain } from './fallback.js';
import { CostTracker } from '../cost/tracker.js';
import { AIStream } from '../streaming/stream.js';
import { NoAvailableProviderError } from '../errors/routing.js';

/** Configuration for the ModelGateway. */
export interface GatewayConfig {
  readonly defaultModel?: string;
  readonly enableFallback?: boolean;
  readonly maxFallbackAttempts?: number;
}

/**
 * Unified Model Gateway.
 *
 * Every AI model interaction in AUREXARA flows through this class.
 * It handles:
 * - Intelligent model routing via ModelRouter
 * - Automatic fallback via FallbackChain
 * - Cost tracking via CostTracker
 * - Stream wrapping via AIStream
 */
export class ModelGateway {
  private readonly registry: ProviderRegistry;
  private readonly router: ModelRouter;
  private readonly fallback: FallbackChain;
  private readonly costTracker: CostTracker;
  private readonly config: Required<GatewayConfig>;

  constructor(params: {
    registry: ProviderRegistry;
    router?: ModelRouter;
    costTracker?: CostTracker;
    config?: GatewayConfig;
  }) {
    this.registry = params.registry;
    this.router = params.router ?? new ModelRouter();
    this.costTracker = params.costTracker ?? new CostTracker();
    this.fallback = new FallbackChain();
    this.config = {
      defaultModel: params.config?.defaultModel ?? 'auto',
      enableFallback: params.config?.enableFallback ?? true,
      maxFallbackAttempts: params.config?.maxFallbackAttempts ?? 3,
    };
  }

  /** Generate a completion. */
  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // 1. Determine model to use
    const resolvedRequest = this.resolveModel(request);

    // 2. Build provider chain (ordered by routing score)
    const providerChain = this.buildProviderChain(resolvedRequest);

    if (providerChain.length === 0) {
      throw new NoAvailableProviderError({ attemptedProviders: [], message: 'No available provider' });
    }

    // 3. Execute with fallback
    if (this.config.enableFallback) {
      const fallbackResult = await this.fallback.execute(
        providerChain,
        async (provider) => {
          const response = await provider.complete(resolvedRequest);
          // Track cost
          this.costTracker.record({
            requestId: response.id,
            provider: response.provider,
            model: response.model,
            usage: response.usage,
          });
          // Record success
          this.registry.recordSuccess(response.provider);
          return response;
        },
        { maxAttempts: this.config.maxFallbackAttempts }
      );
      return fallbackResult.result;
    }

    // No fallback — use first provider directly
    const primary = providerChain[0]!;
    const response = await primary.provider.complete(resolvedRequest);
    this.costTracker.record({
      requestId: response.id,
      provider: response.provider,
      model: response.model,
      usage: response.usage,
    });
    return response;
  }

  /** Generate a streaming completion. */
  stream(request: CompletionRequest): AIStream {
    const resolvedRequest = this.resolveModel(request);
    const providerChain = this.buildProviderChain(resolvedRequest);

    if (providerChain.length === 0) {
      throw new NoAvailableProviderError({ attemptedProviders: [], message: 'No available provider' });
    }

    // Use the primary provider for streaming (fallback is harder with streams)
    const primary = providerChain[0]!;
    const rawStream = primary.provider.stream(resolvedRequest);
    return new AIStream(rawStream);
  }

  /** Generate embeddings. */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Find a provider that supports embeddings
    // For now, try providers in priority order
    const enabledProviders = this.registry.getEnabled();
    for (const entry of enabledProviders) {
      const provider = this.registry.getProvider(entry.id);
      if (!provider) continue;
      try {
        const response = await provider.embed(request);
        this.costTracker.record({
          requestId: Date.now().toString(36) + Math.random().toString(36).slice(2),
          provider: entry.id,
          model: response.model,
          usage: response.usage,
        });
        return response;
      } catch {
        continue; // Try next provider
      }
    }
    throw new NoAvailableProviderError({ attemptedProviders: enabledProviders.map(e => e.id), message: 'No available provider for embeddings' });
  }

  /** Get the cost tracker for reporting. */
  get costs(): CostTracker { return this.costTracker; }

  /** Get the provider registry. */
  get providers(): ProviderRegistry { return this.registry; }

  private resolveModel(request: CompletionRequest): CompletionRequest {
    if (!request.model || request.model === 'auto') {
      // Use router to select best model
      const allModels = this.registry.getAllModels();
      const scored = this.router.route(allModels, request);
      if (scored.length > 0 && scored[0]!.score > -1000) {
        return { ...request, model: scored[0]!.model.id };
      }
    }
    return request;
  }

  private buildProviderChain(request: CompletionRequest): Array<{ entry: ProviderRegistryEntry; provider: IAIProvider }> {
    const enabledProviders = this.registry.getEnabled();
    const chain: Array<{ entry: ProviderRegistryEntry; provider: IAIProvider }> = [];

    for (const entry of enabledProviders) {
      const provider = this.registry.getProvider(entry.id);
      if (!provider) continue;

      // If a specific model is requested, only include providers that have it
      if (request.model && request.model !== 'auto') {
        const hasModel = entry.models.some(m => m.id === request.model);
        if (!hasModel) continue;
      }

      chain.push({ entry, provider });
    }

    return chain;
  }
}
