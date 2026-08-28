import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import type { IAIProvider, ProviderConfig } from './interface.js';
import type { CompletionRequest, EmbeddingRequest } from '../types/requests.js';
import type { CompletionResponse, StreamChunk, EmbeddingResponse, FinishReason } from '../types/responses.js';
import type { Message, ToolDefinition } from '../types/messages.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import type { TokenUsage } from '../types/cost.js';
import {
  ProviderError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
} from '../errors/provider.js';

export class AnthropicProvider implements IAIProvider {
  public readonly id = 'anthropic';
  public readonly name = 'Anthropic';
  private client: Anthropic;

  public readonly models: readonly ModelCapabilities[] = [
    {
      id: 'claude-sonnet-4-20250514',
      provider: 'anthropic',
      displayName: 'Claude 3.5 Sonnet',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: false,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.015,
      tier: 'premium',
    },
    {
      id: 'claude-3-5-haiku-20241022',
      provider: 'anthropic',
      displayName: 'Claude 3.5 Haiku',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.0008,
      outputCostPer1kTokens: 0.004,
      tier: 'fast',
    },
    {
      id: 'claude-opus-4-20250514',
      provider: 'anthropic',
      displayName: 'Claude 4 Opus',
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: false,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.015,
      outputCostPer1kTokens: 0.075,
      tier: 'premium',
    },
  ];

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries,
      timeout: config.timeout,
    });
  }

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model === 'auto' || !request.model ? 'claude-sonnet-4-20250514' : request.model;
    const systemPrompts = request.messages.filter(m => m.role === 'system');
    const system = systemPrompts.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
    
    const messages = this.convertMessages(request.messages.filter(m => m.role !== 'system'));
    const tools = request.tools ? this.convertTools(request.tools) : undefined;
    const requestId = randomUUID();

    let stop_sequences: string[] | undefined = undefined;
    if (typeof request.stop === 'string') {
        stop_sequences = [request.stop];
    } else if (Array.isArray(request.stop)) {
        stop_sequences = request.stop;
    }

    try {
      const response = await this.client.messages.create({
        model,
        messages,
        system: system || undefined,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences,
        tools,
      });

      const textContent = response.content
        .filter(b => b.type === 'text')
        .map(b => (b as Anthropic.TextBlock).text)
        .join('');

      const toolCalls = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => {
          const t = b as Anthropic.ToolUseBlock;
          return {
            id: t.id,
            name: t.name,
            arguments: JSON.stringify(t.input),
          };
        });

      const usage: TokenUsage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      };

      return {
        id: requestId,
        content: textContent,
        role: 'assistant',
        model: response.model,
        provider: this.id,
        usage,
        cost: this.calculateCost(model, usage),
        finishReason: this.mapFinishReason(response.stop_reason),
        toolCalls: toolCalls.length ? toolCalls : undefined,
        metadata: { anthropicId: response.id },
      };
    } catch (error) {
      throw this.mapError(error, model);
    }
  }

  public async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model === 'auto' || !request.model ? 'claude-sonnet-4-20250514' : request.model;
    const systemPrompts = request.messages.filter(m => m.role === 'system');
    const system = systemPrompts.map(m => typeof m.content === 'string' ? m.content : '').join('\n');
    
    const messages = this.convertMessages(request.messages.filter(m => m.role !== 'system'));
    const tools = request.tools ? this.convertTools(request.tools) : undefined;
    const requestId = randomUUID();

    let stop_sequences: string[] | undefined = undefined;
    if (typeof request.stop === 'string') {
        stop_sequences = [request.stop];
    } else if (Array.isArray(request.stop)) {
        stop_sequences = request.stop;
    }

    try {
      const stream = await this.client.messages.stream({
        model,
        messages,
        system: system || undefined,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature,
        top_p: request.topP,
        stop_sequences,
        tools,
      });

      let promptTokens = 0;
      let completionTokens = 0;
      const toolCallsMap = new Map<number, { id: string, name: string, arguments: string }>();

      for await (const event of stream) {
        if (event.type === 'message_start') {
          promptTokens = event.message.usage.input_tokens;
        } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          toolCallsMap.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            arguments: '',
          });
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              id: requestId,
              delta: event.delta.text,
              model,
              provider: this.id,
            };
          } else if (event.delta.type === 'input_json_delta') {
             const tc = toolCallsMap.get(event.index);
             if (tc) {
                 tc.arguments += event.delta.partial_json;
             }
          }
        } else if (event.type === 'message_delta') {
          if (event.usage) {
              completionTokens += event.usage.output_tokens;
          }
          if (event.delta.stop_reason) {
              const toolCalls = Array.from(toolCallsMap.values());
              yield {
                  id: requestId,
                  delta: '',
                  model,
                  provider: this.id,
                  finishReason: this.mapFinishReason(event.delta.stop_reason),
                  usage: {
                      promptTokens,
                      completionTokens,
                      totalTokens: promptTokens + completionTokens
                  },
                  toolCalls: toolCalls.length > 0 ? toolCalls : undefined
              };
          }
        }
      }
    } catch (error) {
      throw this.mapError(error, model);
    }
  }

  public async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new ProviderError({ message: 'Anthropic does not support embeddings', provider: this.id });
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        messages: [{ role: 'user', content: 'hello' }],
        max_tokens: 10,
      });
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        errorRate: 0,
        lastChecked: new Date(),
        consecutiveFailures: 0,
      };
    } catch (error) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        errorRate: 1,
        lastChecked: new Date(),
        consecutiveFailures: 1,
      };
    }
  }

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    return messages.map(msg => {
      let content: string | Array<Anthropic.ContentBlockParam> = '';

      if (msg.role === 'tool') {
        return {
           role: 'user',
           content: [
             {
               type: 'tool_result',
               tool_use_id: msg.toolCallId || '',
               content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
             }
           ]
        };
      }

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        content = msg.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else {
            // For Anthropic, images need to be base64. We assume url contains a data URI or base64
            // In a real system, we'd need to fetch and convert if it's a raw URL.
            // Assuming data URI for now: data:image/jpeg;base64,...
            const urlParts = part.url.split(',');
            const mediaTypeMatch = urlParts[0]?.match(/data:(image\/[a-zA-Z]+);base64/);
            const mediaType = mediaTypeMatch?.[1] ?? 'image/jpeg';
            const data = urlParts[1] ?? '';
            
            return {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data },
            };
          }
        });
      }

      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const blocks: Array<Anthropic.ContentBlockParam> = [];
        if (typeof content === 'string' && content.length > 0) {
            blocks.push({ type: 'text', text: content });
        } else if (Array.isArray(content)) {
            blocks.push(...content);
        }
        
        msg.toolCalls.forEach(tc => {
           let parsedInput = {};
           try { parsedInput = JSON.parse(tc.arguments); } catch (e) {}
           blocks.push({
               type: 'tool_use',
               id: tc.id,
               name: tc.name,
               input: parsedInput
           });
        });
        
        return { role: 'assistant', content: blocks };
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    });
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        ...tool.parameters
      },
    }));
  }

  private mapFinishReason(reason: string | null | undefined): FinishReason {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }

  private calculateCost(modelId: string, usage: TokenUsage): number {
    const model = this.models.find(m => m.id === modelId);
    if (!model) return 0;

    const inputCost = (usage.promptTokens / 1000) * model.inputCostPer1kTokens;
    const outputCost = (usage.completionTokens / 1000) * model.outputCostPer1kTokens;
    return inputCost + outputCost;
  }

  private mapError(error: unknown, model?: string): Error {
    if (error instanceof Anthropic.APIError) {
      const metadata = { status: error.status, type: error.name };
      
      switch (error.status) {
        case 401:
        case 403:
          return new AuthenticationError({ message: error.message, provider: this.id, cause: error, metadata });
        case 429:
          return new RateLimitError({ message: error.message, provider: this.id, model, cause: error, metadata });
        case 408:
        case 524:
        case 504:
          return new TimeoutError({ message: error.message, provider: this.id, model, cause: error, metadata });
        case 400:
          return new ProviderError({ message: error.message, provider: this.id, model, cause: error, metadata });
        default:
          return new ProviderError({ message: error.message, provider: this.id, model, cause: error, metadata });
      }
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return new TimeoutError({ message: error.message, provider: this.id, model, cause: error });
      }
      return new ProviderError({ message: error.message, provider: this.id, model, cause: error });
    }

    return new ProviderError({ message: String(error), provider: this.id, model });
  }
}
