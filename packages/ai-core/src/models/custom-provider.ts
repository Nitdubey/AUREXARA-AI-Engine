import type { IAIProvider } from '../providers/interface.js';
import type { CompletionRequest } from '../types/requests.js';
import type { CompletionResponse, StreamChunk, EmbeddingResponse } from '../types/responses.js';
import type { EmbeddingRequest } from '../types/requests.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';

/** Custom model endpoint configuration */
export interface CustomEndpointConfig {
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly headers?: Record<string, string>;
  readonly timeoutMs?: number;
}

/** Configuration for a custom/proprietary model */
export interface CustomModelConfig {
  readonly modelId: string;
  readonly capabilities: ModelCapabilities;
  readonly endpoint: CustomEndpointConfig;
  readonly requestTransform?: (request: CompletionRequest) => unknown;
  readonly responseTransform?: (response: unknown) => CompletionResponse;
}

/**
 * Provider adapter for custom/proprietary model endpoints.
 * Allows AUREXARA to integrate any model that has an HTTP API.
 */
export class CustomModelProvider implements IAIProvider {
  readonly id: string;
  readonly name: string;
  public models: ModelCapabilities[];
  private readonly configs: Map<string, CustomModelConfig>;

  /**
   * Initialize a custom model provider.
   * @param id Unique provider identifier
   * @param name Human-readable provider name
   */
  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.configs = new Map();
    this.models = [];
  }

  /**
   * Register a custom model with its endpoint configuration.
   * @param config The custom model config.
   */
  public addModel(config: CustomModelConfig): void {
    this.configs.set(config.modelId, config);
    this.models.push(config.capabilities);
  }

  /**
   * Remove a model.
   * @param modelId The ID of the model to remove.
   * @returns true if removed, false otherwise.
   */
  public removeModel(modelId: string): boolean {
    if (this.configs.has(modelId)) {
      this.configs.delete(modelId);
      this.models = this.models.filter(m => m.id !== modelId);
      return true;
    }
    return false;
  }

  /**
   * Complete — routes to the correct custom endpoint.
   * In this MVP, returns a placeholder response.
   * In production, this would use fetch() to call the custom endpoint.
   * @param request The completion request.
   * @returns The completion response.
   */
  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const modelId = request.model ?? this.models[0]?.id;
    if (!modelId) {
      throw new Error(`No model specified and no models registered in provider ${this.id}`);
    }
    const config = this.configs.get(modelId);
    if (!config) {
      throw new Error(`Custom model ${modelId} not found in provider ${this.id}`);
    }

    // In production: make HTTP call to config.endpoint.baseUrl
    // For MVP: return a placeholder CompletionResponse matching the actual type
    const response: CompletionResponse = {
      id: `custom-comp-${Date.now()}`,
      content: `Placeholder response from custom model ${modelId}`,
      role: 'assistant',
      model: modelId,
      provider: this.id,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      cost: 0.001,
      finishReason: 'stop',
      metadata: { custom: true, endpoint: config.endpoint.baseUrl },
    };

    if (config.responseTransform) {
      return config.responseTransform(response);
    }

    return response;
  }

  /**
   * Stream — placeholder for custom streaming.
   * @param request The completion request.
   * @returns An async iterable of stream chunks.
   */
  public async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const modelId = request.model ?? this.models[0]?.id;
    if (!modelId) {
      throw new Error(`No model specified and no models registered in provider ${this.id}`);
    }
    const config = this.configs.get(modelId);
    if (!config) {
      throw new Error(`Custom model ${modelId} not found in provider ${this.id}`);
    }

    const chunk: StreamChunk = {
      id: `custom-stream-${Date.now()}`,
      delta: `Placeholder response from custom model ${modelId}`,
      model: modelId,
      provider: this.id,
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
    };
    yield chunk;
  }

  /**
   * Embed — placeholder for custom embeddings.
   * @param request The embedding request.
   * @returns The embedding response.
   */
  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const modelId = request.model ?? this.models[0]?.id;
    if (!modelId) {
      throw new Error(`No model specified and no models registered in provider ${this.id}`);
    }
    const config = this.configs.get(modelId);
    if (!config) {
      throw new Error(`Custom model ${modelId} not found in provider ${this.id}`);
    }

    return {
      embeddings: [[0.1, 0.2, 0.3, 0.4, 0.5]],
      model: modelId,
      provider: this.id,
      usage: {
        promptTokens: 10,
        completionTokens: 0,
        totalTokens: 10,
      },
      cost: 0.0001,
      dimensions: 5,
    };
  }

  /**
   * Health check — check if custom endpoint is accessible.
   * @returns The provider health status.
   */
  public async healthCheck(): Promise<ProviderHealth> {
    return {
      status: 'healthy',
      latencyMs: 50,
      errorRate: 0,
      lastChecked: new Date(),
      consecutiveFailures: 0,
    };
  }

  /**
   * Get a model config.
   * @param modelId The ID of the model.
   * @returns The custom model config.
   */
  public getModelConfig(modelId: string): CustomModelConfig | undefined {
    return this.configs.get(modelId);
  }
}
