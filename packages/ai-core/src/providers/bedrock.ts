import type { CompletionRequest, EmbeddingRequest } from '../types/requests.js';
import type { CompletionResponse, EmbeddingResponse, StreamChunk } from '../types/responses.js';
import type { IAIProvider, ProviderConfig } from './interface.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import { randomUUID } from 'node:crypto';

export class AmazonBedrockProvider implements IAIProvider {
  public readonly id = 'bedrock';
  public readonly name = 'Amazon Bedrock';
  public readonly config: ProviderConfig;
  public readonly models: readonly ModelCapabilities[] = [
    { 
      id: 'anthropic.claude-3-haiku-20240307-v1:0', 
      displayName: 'Claude 3 Haiku', 
      provider: 'bedrock', 
      contextWindow: 200000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00025,
      outputCostPer1kTokens: 0.00125,
      tier: 'fast'
    },
    { 
      id: 'amazon.titan-embed-text-v1', 
      displayName: 'Titan Embed', 
      provider: 'bedrock', 
      contextWindow: 8192,
      maxOutputTokens: 0,
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsStreaming: false,
      inputCostPer1kTokens: 0.0001,
      outputCostPer1kTokens: 0.0001,
      tier: 'fast'
    }
  ];

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  public async healthCheck(): Promise<ProviderHealth> {
    return { 
      status: 'healthy', 
      latencyMs: 50,
      errorRate: 0,
      lastChecked: new Date(),
      consecutiveFailures: 0
    };
  }

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model && request.model !== 'auto' ? request.model : 'anthropic.claude-3-haiku-20240307-v1:0';
    
    let content = `[Bedrock Response generated using model: ${model} with bearer token]\nSimulated response for: ` + (request.messages[request.messages.length - 1]?.content || '');
    
    const isJsonRequested = request.messages.some(m => typeof m.content === 'string' && m.content.includes('JSON'));
    if (isJsonRequested) {
      if (request.messages.some(m => typeof m.content === 'string' && m.content.includes('candidateId'))) {
        // Job Match Mock
        content = JSON.stringify({ 
          matches: [
            { candidateId: "Candidate 1", fitScore: 95, reason: "Excellent match found via Amazon Bedrock (Simulated)" }
          ] 
        });
      } else {
        // Resume Parse Mock
        content = JSON.stringify({ name: "Bedrock Mock Candidate", email: "mock@bedrock.aws", phone: "555-0000", skills: ["AWS Bedrock", "Titan", "Claude 3"] });
      }
    }

    return {
      id: `bedrock-comp-${randomUUID()}`,
      model,
      provider: 'bedrock',
      role: 'assistant',
      content,
      finishReason: 'stop',
      usage: { promptTokens: 15, completionTokens: 45, totalTokens: 60 },
      cost: 0.001,
      metadata: {}
    };
  }

  public async *stream(_request: CompletionRequest): AsyncIterable<StreamChunk> {
    throw new Error('Streaming is not implemented for the simulated Bedrock provider yet.');
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Generate a pseudo-deterministic embedding based on input length to get consistent matching
    const inputLength = Array.isArray(request.input) ? request.input.join('').length : request.input.length;
    const baseVal = (inputLength % 100) / 100;
    
    return {
      model: request.model ?? 'amazon.titan-embed-text-v1',
      provider: 'bedrock',
      embeddings: [Array.from({ length: 1536 }, (_, i) => baseVal + (i % 10) * 0.01)],
      usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 },
      cost: 0.0001,
      dimensions: 1536
    };
  }
}
