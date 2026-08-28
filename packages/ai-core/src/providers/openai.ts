import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import type { IAIProvider, ProviderConfig } from './interface.js';
import type { CompletionRequest, EmbeddingRequest } from '../types/requests.js';
import type { CompletionResponse, StreamChunk, EmbeddingResponse, FinishReason } from '../types/responses.js';
import type { Message, ToolDefinition, Role } from '../types/messages.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import type { TokenUsage } from '../types/cost.js';
import {
  ProviderError,
  RateLimitError,
  AuthenticationError,
  TimeoutError,
  ContentFilteredError,
  ContextLengthExceededError,
} from '../errors/provider.js';

export class OpenAIProvider implements IAIProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI';
  private client: OpenAI;

  public readonly models: readonly ModelCapabilities[] = [
    {
      id: 'gpt-4o',
      provider: 'openai',
      displayName: 'GPT-4o',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.0025,
      outputCostPer1kTokens: 0.010,
      tier: 'premium',
    },
    {
      id: 'gpt-4o-mini',
      provider: 'openai',
      displayName: 'GPT-4o Mini',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00015,
      outputCostPer1kTokens: 0.00060,
      tier: 'fast',
    },
    {
      id: 'gpt-4-turbo',
      provider: 'openai',
      displayName: 'GPT-4 Turbo',
      contextWindow: 128000,
      maxOutputTokens: 4096,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: true,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.010,
      outputCostPer1kTokens: 0.030,
      tier: 'premium',
    },
    {
      id: 'o1',
      provider: 'openai',
      displayName: 'o1',
      contextWindow: 200000,
      maxOutputTokens: 100000,
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.015,
      outputCostPer1kTokens: 0.060,
      tier: 'reasoning',
    },
    {
      id: 'o1-mini',
      provider: 'openai',
      displayName: 'o1 Mini',
      contextWindow: 128000,
      maxOutputTokens: 65536,
      supportsTools: false,
      supportsStructuredOutput: false,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.003,
      outputCostPer1kTokens: 0.012,
      tier: 'reasoning',
    },
  ];

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      organization: config.organization,
    });
  }

  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model === 'auto' || !request.model ? 'gpt-4o' : request.model;
    const messages = this.convertMessages(request.messages);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;
    const requestId = randomUUID();

    const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stop: request.stop,
      tools: tools?.length ? tools : undefined,
    };

    if (request.responseFormat) {
      if (request.responseFormat.type === 'json_object') {
        params.response_format = { type: 'json_object' };
      } else if (request.responseFormat.type === 'json_schema' && request.responseFormat.schema) {
        params.response_format = {
          type: 'json_schema',
          json_schema: {
            name: request.responseFormat.name || 'schema',
            schema: request.responseFormat.schema,
            strict: request.responseFormat.strict ?? false,
          },
        };
      }
    }

    try {
      const response = await this.client.chat.completions.create(params);
      
      const choice = response.choices[0];
      if (!choice) {
        throw new Error('No choice returned from OpenAI');
      }

      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens ?? 0,
        completionTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      };

      const toolCalls = choice.message.tool_calls?.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return {
        id: requestId,
        content: choice.message.content ?? '',
        role: choice.message.role as Role,
        model: response.model,
        provider: this.id,
        usage,
        cost: this.calculateCost(model, usage),
        finishReason: this.mapFinishReason(choice.finish_reason),
        toolCalls,
        metadata: {
          openaiId: response.id,
          systemFingerprint: response.system_fingerprint,
        },
      };
    } catch (error) {
      throw this.mapError(error, model);
    }
  }

  public async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const model = request.model === 'auto' || !request.model ? 'gpt-4o' : request.model;
    const messages = this.convertMessages(request.messages);
    const tools = request.tools ? this.convertTools(request.tools) : undefined;
    const requestId = randomUUID();

    const params: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      top_p: request.topP,
      frequency_penalty: request.frequencyPenalty,
      presence_penalty: request.presencePenalty,
      stop: request.stop,
      tools: tools?.length ? tools : undefined,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (request.responseFormat) {
      if (request.responseFormat.type === 'json_object') {
        params.response_format = { type: 'json_object' };
      } else if (request.responseFormat.type === 'json_schema' && request.responseFormat.schema) {
        params.response_format = {
          type: 'json_schema',
          json_schema: {
            name: request.responseFormat.name || 'schema',
            schema: request.responseFormat.schema,
            strict: request.responseFormat.strict ?? false,
          },
        };
      }
    }

    try {
      const stream = await this.client.chat.completions.create(params);

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        const usage = chunk.usage;

        let mappedUsage: TokenUsage | undefined = undefined;
        if (usage) {
          mappedUsage = {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          };
        }

        const toolCalls = choice?.delta?.tool_calls?.map(tc => {
          return {
            id: tc.id || '',
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '',
          };
        });

        yield {
          id: requestId,
          delta: choice?.delta?.content ?? '',
          model: chunk.model,
          provider: this.id,
          finishReason: choice?.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined,
          usage: mappedUsage,
          toolCalls: toolCalls?.length ? toolCalls : undefined,
        };
      }
    } catch (error) {
      throw this.mapError(error, model);
    }
  }

  public async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model || 'text-embedding-3-small';
    try {
      const response = await this.client.embeddings.create({
        input: request.input,
        model,
        dimensions: request.dimensions,
      });

      const usage: TokenUsage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: 0,
        totalTokens: response.usage.total_tokens,
      };

      return {
        embeddings: response.data.map(d => d.embedding),
        model: response.model,
        provider: this.id,
        usage,
        cost: 0, // Simplified for now, no cost data in model array for embeddings
        dimensions: response.data[0]?.embedding.length ?? 0,
      };
    } catch (error) {
      throw this.mapError(error, model);
    }
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.models.list();
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

  private convertMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    return messages.map(msg => {
      let content: string | OpenAI.Chat.ChatCompletionContentPart[] = '';

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else {
        content = msg.content.map(part => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          } else {
            return {
              type: 'image_url',
              image_url: { url: part.url, detail: part.detail },
            };
          }
        });
      }

      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: typeof content === 'string' ? content : JSON.stringify(content),
          tool_call_id: msg.toolCallId || '',
        };
      } else if (msg.role === 'assistant' && msg.toolCalls) {
        return {
          role: 'assistant',
          content: typeof content === 'string' ? content : null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: content as any,
        name: msg.name,
      };
    });
  }

  private convertTools(tools: ToolDefinition[]): OpenAI.Chat.ChatCompletionTool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: tool.strict,
      },
    }));
  }

  private mapFinishReason(reason: string | null): FinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
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
    if (error instanceof OpenAI.APIError) {
      const metadata = { status: error.status, type: error.type, code: error.code };
      
      switch (error.status) {
        case 401:
        case 403:
          return new AuthenticationError({ message: error.message, provider: this.id, cause: error, metadata });
        case 429:
          return new RateLimitError({ message: error.message, provider: this.id, model, cause: error, metadata });
        case 408:
        case 504:
          return new TimeoutError({ message: error.message, provider: this.id, model, cause: error, metadata });
        case 400:
          if (error.code === 'context_length_exceeded') {
            return new ContextLengthExceededError({ message: error.message, provider: this.id, model, cause: error, metadata });
          }
          if (error.message.toLowerCase().includes('content filter')) {
             return new ContentFilteredError({ message: error.message, provider: this.id, model, cause: error, metadata });
          }
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
