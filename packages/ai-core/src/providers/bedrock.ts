import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { CompletionRequest, EmbeddingRequest } from '../types/requests.js';
import type { CompletionResponse, EmbeddingResponse, StreamChunk } from '../types/responses.js';
import type { IAIProvider, ProviderConfig } from './interface.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import { randomUUID } from 'node:crypto';

/**
 * Amazon Bedrock Provider — LIVE Implementation via AWS SDK
 * 
 * Uses @aws-sdk/client-bedrock-runtime with IAM credentials (SigV4)
 * Supports: Claude 3.5 Haiku/Sonnet, Amazon Nova, Titan Embeddings
 */
export class AmazonBedrockProvider implements IAIProvider {
  public readonly id = 'bedrock';
  public readonly name = 'Amazon Bedrock';
  public readonly config: ProviderConfig;
  
  private readonly client: BedrockRuntimeClient;
  private readonly region: string;

  public readonly models: readonly ModelCapabilities[] = [
    { 
      id: 'anthropic.claude-3-5-haiku-20241022-v1:0', 
      displayName: 'Claude 3.5 Haiku', 
      provider: 'bedrock', 
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.001,
      outputCostPer1kTokens: 0.005,
      tier: 'fast'
    },
    { 
      id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', 
      displayName: 'Claude 3.5 Sonnet v2', 
      provider: 'bedrock', 
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      tier: 'balanced'
    },
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
      id: 'amazon.titan-embed-text-v2:0', 
      displayName: 'Titan Embed v2', 
      provider: 'bedrock', 
      contextWindow: 8192,
      maxOutputTokens: 0,
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsStreaming: false,
      inputCostPer1kTokens: 0.00002,
      outputCostPer1kTokens: 0,
      tier: 'fast'
    }
  ];

  constructor(config: ProviderConfig) {
    this.config = config;
    this.region = process.env['BEDROCK_REGION'] || 'eu-north-1';
    
    // Initialize AWS SDK client with IAM credentials
    this.client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] || '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] || '',
      },
    });
    
    console.log(`[Bedrock] ✅ LIVE provider initialized via AWS SDK (region: ${this.region})`);
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.invokeClaudeModel('anthropic.claude-3-haiku-20240307-v1:0', [
        { role: 'user', content: 'Say "ok"' }
      ], undefined, 10);
      
      return { 
        status: 'healthy', 
        latencyMs: Date.now() - start,
        errorRate: 0,
        lastChecked: new Date(),
        consecutiveFailures: 0
      };
    } catch (error) {
      console.error(`[Bedrock] Health check failed:`, error);
      return { 
        status: 'down', 
        latencyMs: Date.now() - start,
        errorRate: 1,
        lastChecked: new Date(),
        consecutiveFailures: 1
      };
    }
  }

  /**
   * Invoke a Claude model via Bedrock
   */
  private async invokeClaudeModel(
    modelId: string,
    messages: Array<{ role: string; content: string }>,
    systemPrompt?: string,
    maxTokens: number = 4096,
    temperature?: number,
  ): Promise<{ content: string; inputTokens: number; outputTokens: number; stopReason: string }> {
    
    const body: Record<string, unknown> = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    console.log(`[Bedrock] 🔄 Calling ${modelId} (${messages.length} messages, max_tokens: ${maxTokens})`);

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: new TextEncoder().encode(JSON.stringify(body)),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Parse Claude response: { content: [{ type: "text", text: "..." }], usage: { input_tokens, output_tokens }, stop_reason }
    const contentBlocks = responseBody.content as Array<{ type: string; text: string }> | undefined;
    const content = contentBlocks 
      ? contentBlocks.filter(b => b.type === 'text').map(b => b.text).join('') 
      : String(responseBody.completion || '');

    const usage = responseBody.usage as { input_tokens?: number; output_tokens?: number } | undefined;

    console.log(`[Bedrock] ✅ Response received (${(usage?.input_tokens || 0) + (usage?.output_tokens || 0)} tokens)`);

    return {
      content,
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
      stopReason: String(responseBody.stop_reason || 'end_turn'),
    };
  }

  /**
   * LIVE completion using Claude via Bedrock AWS SDK
   */
  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model && request.model !== 'auto' 
      ? request.model 
      : 'anthropic.claude-3-5-haiku-20241022-v1:0';
    
    // Separate system messages from user/assistant messages
    const systemMessages = request.messages.filter(m => m.role === 'system');
    const chatMessages = request.messages.filter(m => m.role !== 'system');
    
    const systemPrompt = systemMessages.length > 0 
      ? systemMessages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n\n')
      : undefined;

    const formattedMessages = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    // Ensure messages start with a user message (Anthropic requirement)
    if (formattedMessages.length === 0 || formattedMessages[0]!.role !== 'user') {
      formattedMessages.unshift({ role: 'user', content: 'Hello' });
    }

    try {
      const result = await this.invokeClaudeModel(
        model,
        formattedMessages,
        systemPrompt,
        request.maxTokens || 4096,
        request.temperature,
      );

      // Calculate cost
      const modelInfo = this.models.find(m => m.id === model) || this.models[0]!;
      const cost = (result.inputTokens * modelInfo.inputCostPer1kTokens / 1000) + 
                   (result.outputTokens * modelInfo.outputCostPer1kTokens / 1000);

      return {
        id: `bedrock-${randomUUID()}`,
        model,
        provider: 'bedrock',
        role: 'assistant',
        content: result.content,
        finishReason: 'stop' as const,
        usage: { 
          promptTokens: result.inputTokens, 
          completionTokens: result.outputTokens, 
          totalTokens: result.inputTokens + result.outputTokens 
        },
        cost,
        metadata: { region: this.region, live: true }
      };
    } catch (error) {
      console.error(`[Bedrock] ❌ Completion failed:`, error);
      throw error;
    }
  }

  /**
   * LIVE streaming — falls back to non-streaming for now
   */
  public async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const response = await this.complete(request);
    yield {
      id: response.id,
      model: response.model,
      provider: 'bedrock',
      delta: response.content,
      finishReason: response.finishReason,
      usage: response.usage
    };
  }

  /**
   * LIVE embeddings using Titan Embed v2 via Bedrock AWS SDK
   */
  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? 'amazon.titan-embed-text-v2:0';
    const inputText = Array.isArray(request.input) ? request.input.join(' ') : request.input;

    console.log(`[Bedrock] 🔄 Generating embedding with ${model}`);

    try {
      const command = new InvokeModelCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: new TextEncoder().encode(JSON.stringify({ inputText })),
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      // Titan response: { embedding: number[], inputTextTokenCount: number }
      const embedding = responseBody.embedding as number[];
      const tokenCount = (responseBody.inputTextTokenCount as number) || 0;

      const modelInfo = this.models.find(m => m.id === model) || this.models[3]!;
      const cost = (tokenCount * modelInfo.inputCostPer1kTokens / 1000);

      console.log(`[Bedrock] ✅ Embedding generated (${embedding.length} dimensions, ${tokenCount} tokens)`);

      return {
        model,
        provider: 'bedrock',
        embeddings: [embedding],
        usage: { promptTokens: tokenCount, completionTokens: 0, totalTokens: tokenCount },
        cost,
        dimensions: embedding.length
      };
    } catch (error) {
      console.error(`[Bedrock] ❌ Embedding failed:`, error);
      throw error;
    }
  }
}
