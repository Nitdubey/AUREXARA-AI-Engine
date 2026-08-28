import type { IAIProvider } from './interface.js';
import type { CompletionRequest, CompletionResponse, StreamChunk, Message, EmbeddingRequest, EmbeddingResponse } from '../types/index.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import { ProviderError } from '../errors/provider.js';
import { randomUUID } from 'node:crypto';

export class GoogleProvider implements IAIProvider {
  public readonly id = 'google';
  public readonly name = 'Google AI';
  public readonly models: readonly ModelCapabilities[] = [
    {
      id: 'gemini-1.5-pro',
      provider: 'google',
      displayName: 'Gemini 1.5 Pro',
      contextWindow: 2000000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.0035,
      outputCostPer1kTokens: 0.0105,
      tier: 'premium',
    }
  ];

  constructor(private readonly apiKey: string) {}

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new ProviderError({ message: 'Google API key is missing', provider: 'google' });
    }

    try {
      const modelId = request.model || 'gemini-1.5-pro';
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: request.messages.map((m: Message) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
          })),
          generationConfig: {
            temperature: request.temperature ?? 0.7,
            maxOutputTokens: request.maxTokens,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Google API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as any;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return {
        id: `gapi-${randomUUID()}`,
        content: text,
        role: 'assistant',
        provider: this.id,
        cost: 0,
        finishReason: 'stop',
        metadata: {},
        model: modelId,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (error) {
      throw new ProviderError({ 
        message: `Google API Error: ${error instanceof Error ? error.message : String(error)}`,
        provider: 'google',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  public async *stream(_request: CompletionRequest): AsyncIterable<StreamChunk> {
    const id = `gapi-${randomUUID()}`;
    const model = _request.model || 'gemini-1.5-pro';
    yield { id, provider: 'google', model, delta: 'This ' };
    yield { id, provider: 'google', model, delta: 'is ' };
    yield { id, provider: 'google', model, delta: 'a ' };
    yield { id, provider: 'google', model, delta: 'Google ' };
    yield { id, provider: 'google', model, delta: 'stream.', finishReason: 'stop' };
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    return {
      embeddings: [[0.1, 0.2, 0.3]],
      model: request.model || 'text-embedding-004',
      provider: this.id,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      cost: 0,
      dimensions: 3
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return {
      status: 'healthy',
      latencyMs: 10,
      errorRate: 0,
      lastChecked: new Date(),
      consecutiveFailures: 0
    };
  }
}
