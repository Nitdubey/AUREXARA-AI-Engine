import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelGateway } from '../gateway/gateway.js';
import { ProviderRegistry } from '../gateway/registry.js';
import { ModelRouter } from '../gateway/router.js';
import { CostTracker } from '../cost/tracker.js';
import { NoAvailableProviderError } from '../errors/routing.js';
import { AIError } from '../errors/base.js';
import type { IAIProvider } from '../providers/interface.js';
import type { ModelCapabilities } from '../types/models.js';
import type { CompletionResponse, EmbeddingResponse } from '../types/responses.js';

function createMockProvider(id: string, models: ModelCapabilities[]): IAIProvider {
  return {
    id,
    name: `Mock ${id}`,
    models,
    complete: vi.fn(),
    stream: vi.fn(),
    embed: vi.fn(),
    healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', latencyMs: 10, errorRate: 0, lastChecked: new Date(), consecutiveFailures: 0 }),
  };
}

describe('ModelGateway', () => {
  let registry: ProviderRegistry;
  let gateway: ModelGateway;
  let primaryProvider: IAIProvider;
  let fallbackProvider: IAIProvider;

  const mockModel1: ModelCapabilities = { id: 'model-1', provider: 'primary', displayName: 'Model 1', contextWindow: 1000, maxOutputTokens: 1000, supportsTools: false, supportsStructuredOutput: false, supportsVision: false, supportsStreaming: true, inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.01, tier: 'fast' };
  const mockModel2: ModelCapabilities = { id: 'model-1', provider: 'fallback', displayName: 'Model 1', contextWindow: 1000, maxOutputTokens: 1000, supportsTools: false, supportsStructuredOutput: false, supportsVision: false, supportsStreaming: true, inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.01, tier: 'fast' };

  beforeEach(() => {
    registry = new ProviderRegistry();
    
    primaryProvider = createMockProvider('primary', [mockModel1]);
    fallbackProvider = createMockProvider('fallback', [mockModel2]);

    registry.register(primaryProvider, { priority: 1 });
    registry.register(fallbackProvider, { priority: 2 });

    gateway = new ModelGateway({ registry });
  });

  it('complete() — routes to provider and returns response', async () => {
    const mockResponse: CompletionResponse = {
      id: 'resp-1',
      content: 'Hello',
      role: 'assistant',
      model: 'model-1',
      provider: 'primary',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      cost: 0,
      finishReason: 'stop',
      metadata: {}
    };
    
    vi.mocked(primaryProvider.complete).mockResolvedValue(mockResponse);

    const response = await gateway.complete({ messages: [], model: 'model-1' });
    
    expect(response).toEqual(mockResponse);
    expect(primaryProvider.complete).toHaveBeenCalledTimes(1);
    expect(fallbackProvider.complete).not.toHaveBeenCalled();
  });

  it('complete() with fallback — primary fails, secondary succeeds', async () => {
    const retryableError = new AIError({ message: 'Rate limit', code: 'RATE_LIMIT', retryable: true });
    vi.mocked(primaryProvider.complete).mockRejectedValue(retryableError);

    const mockResponse: CompletionResponse = {
      id: 'resp-2',
      content: 'Hello from fallback',
      role: 'assistant',
      model: 'model-1',
      provider: 'fallback',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      cost: 0,
      finishReason: 'stop',
      metadata: {}
    };
    vi.mocked(fallbackProvider.complete).mockResolvedValue(mockResponse);

    const response = await gateway.complete({ messages: [], model: 'model-1' });

    expect(response).toEqual(mockResponse);
    expect(primaryProvider.complete).toHaveBeenCalledTimes(1);
    expect(fallbackProvider.complete).toHaveBeenCalledTimes(1);
  });

  it('complete() — records cost', async () => {
    const mockResponse: CompletionResponse = {
      id: 'resp-1',
      content: 'Hello',
      role: 'assistant',
      model: 'gpt-4o', // registered in default pricing
      provider: 'primary',
      usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
      cost: 0,
      finishReason: 'stop',
      metadata: {}
    };
    vi.mocked(primaryProvider.complete).mockResolvedValue(mockResponse);

    await gateway.complete({ messages: [], model: 'model-1' });
    
    expect(gateway.costs.getRecords()).toHaveLength(1);
    expect(gateway.costs.getTotalSpend()).toBeGreaterThan(0);
  });

  it('stream() — returns AIStream', () => {
    async function* mockStream() { yield { id: '1', delta: 'hi', model: 'm', provider: 'p' }; }
    vi.mocked(primaryProvider.stream).mockReturnValue(mockStream());

    const stream = gateway.stream({ messages: [], model: 'model-1' });
    expect(stream.constructor.name).toBe('AIStream');
  });

  it('embed() — routes to embedding provider', async () => {
    const mockEmbedResponse: EmbeddingResponse = {
      embeddings: [[0.1, 0.2]],
      model: 'emb-1',
      provider: 'primary',
      usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
      cost: 0,
      dimensions: 2
    };
    vi.mocked(primaryProvider.embed).mockResolvedValue(mockEmbedResponse);

    const response = await gateway.embed({ input: 'test' });
    expect(response).toEqual(mockEmbedResponse);
    expect(primaryProvider.embed).toHaveBeenCalledTimes(1);
  });

  it('no providers — throws NoAvailableProviderError', async () => {
    const emptyGateway = new ModelGateway({ registry: new ProviderRegistry() });
    
    await expect(emptyGateway.complete({ messages: [], model: 'auto' })).rejects.toThrow(NoAvailableProviderError);
  });
});
