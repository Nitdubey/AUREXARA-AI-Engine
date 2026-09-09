import type { CompletionRequest, EmbeddingRequest } from '../types/requests.js';
import type { CompletionResponse, EmbeddingResponse, StreamChunk } from '../types/responses.js';
import type { IAIProvider, ProviderConfig } from './interface.js';
import type { ModelCapabilities, ProviderHealth } from '../types/models.js';
import { randomUUID } from 'node:crypto';

/**
 * AWS Bedrock Mantle Provider — The Arsenal Engine
 * 
 * Uses the OpenAI-compatible `bedrock-mantle` endpoint with Bearer Token auth.
 * Endpoint: https://bedrock-mantle.{region}.api.aws/v1/chat/completions
 * 
 * Arsenal Plan (8 Specialist Models):
 * ─────────────────────────────────────────────────────
 * EXTRACTION  → qwen.qwen3-235b-a22b-2507     (Perfect JSON)
 * ATS/TECH    → nvidia.nemotron-super-3-120b   (Precision matching)
 * LIGHTWEIGHT → qwen.qwen3-next-80b-a3b        (Fast & cheap)
 * WRITING     → mistral.mistral-large-3-675b    (Professional tone)
 * REASONING   → deepseek.v3.2                   (Logic king)
 * CONVERSATION→ openai.gpt-oss-120b             (Roleplay master)
 * CODING      → qwen.qwen3-coder-480b-a35b      (Code specialist)
 * SPRINTER    → nvidia.nemotron-nano-3-30b       (Ultra-cheap quick tasks)
 */
export class BedrockMantleProvider implements IAIProvider {
  public readonly id = 'mantle';
  public readonly name = 'AWS Bedrock Mantle (Arsenal)';
  public readonly config: ProviderConfig;

  private readonly baseUrl: string;
  private readonly bearerToken: string;

  /**
   * All 8 Arsenal specialist models with accurate pricing & capabilities.
   */
  public readonly models: readonly ModelCapabilities[] = [
    // ── EXTRACTION: Cleanest raw JSON output of ALL models tested ──
    {
      id: 'qwen.qwen3-235b-a22b-2507',
      displayName: 'Qwen3 235B (Extractor)',
      provider: 'mantle',
      contextWindow: 256000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00022,
      outputCostPer1kTokens: 0.00068,
      tier: 'fast',
    },
    // ── ATS/TECH MATCHING: Military precision keyword analysis ──
    {
      id: 'nvidia.nemotron-super-3-120b',
      displayName: 'Nemotron Super 120B (ATS)',
      provider: 'mantle',
      contextWindow: 256000,
      maxOutputTokens: 32768,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.0001,
      outputCostPer1kTokens: 0.00005,
      tier: 'fast',
    },
    // ── LIGHTWEIGHT: Fast extraction & general quick tasks ──
    {
      id: 'qwen.qwen3-next-80b-a3b-instruct',
      displayName: 'Qwen3 Next 80B (Light)',
      provider: 'mantle',
      contextWindow: 256000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00015,
      outputCostPer1kTokens: 0.00012,
      tier: 'fast',
    },
    // ── WRITING: 675B params, professional & human-like tone ──
    {
      id: 'mistral.mistral-large-3-675b-instruct',
      displayName: 'Mistral Large 3 675B (Writer)',
      provider: 'mantle',
      contextWindow: 256000,
      maxOutputTokens: 32768,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.0006,
      outputCostPer1kTokens: 0.0015,
      tier: 'balanced',
    },
    // ── REASONING: World's #1 reasoning model ──
    {
      id: 'deepseek.v3.2',
      displayName: 'DeepSeek V3.2 (Strategist)',
      provider: 'mantle',
      contextWindow: 164000,
      maxOutputTokens: 8192,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00074,
      outputCostPer1kTokens: 0.00222,
      tier: 'reasoning',
    },
    // ── CONVERSATION: GPT family, king of roleplay & empathy ──
    {
      id: 'openai.gpt-oss-120b',
      displayName: 'GPT OSS 120B (Conversationalist)',
      provider: 'mantle',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00015,
      outputCostPer1kTokens: 0.0006,
      tier: 'balanced',
    },
    // ── CODING: Purpose-built 480B coding specialist ──
    {
      id: 'qwen.qwen3-coder-480b-a35b-instruct',
      displayName: 'Qwen3 Coder 480B (Code)',
      provider: 'mantle',
      contextWindow: 128000,
      maxOutputTokens: 16384,
      supportsTools: true,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00007,
      outputCostPer1kTokens: 0.0003,
      tier: 'balanced',
    },
    // ── SPRINTER: Ultra-cheap for emails, bullets, tips ──
    {
      id: 'nvidia.nemotron-nano-3-30b',
      displayName: 'Nemotron Nano 30B (Sprinter)',
      provider: 'mantle',
      contextWindow: 256000,
      maxOutputTokens: 8192,
      supportsTools: false,
      supportsStructuredOutput: true,
      supportsVision: false,
      supportsStreaming: true,
      inputCostPer1kTokens: 0.00008,
      outputCostPer1kTokens: 0.0001,
      tier: 'fast',
    },
  ];

  constructor(config: ProviderConfig) {
    this.config = config;
    this.bearerToken = config.apiKey;
    const region = process.env['BEDROCK_REGION'] || 'us-east-1';
    this.baseUrl = config.baseUrl || `https://bedrock-mantle.${region}.api.aws/v1`;

    console.log(`[Mantle] ⚡ Arsenal Provider initialized (${this.models.length} specialist models, region: ${region})`);
  }

  /**
   * Generate a completion via OpenAI-compatible Mantle endpoint.
   */
  public async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = this.resolveModel(request);

    // Format messages for OpenAI-compatible API
    const messages = request.messages.map(m => ({
      role: m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: request.maxTokens || 4096,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    console.log(`[Mantle] 🔄 ${model} ← ${messages.length} messages`);
    const start = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Mantle] ❌ ${model} error (${response.status}): ${errorBody}`);
      throw new Error(`Mantle API error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as {
      id?: string;
      model?: string;
      choices?: Array<{ message?: { content?: string; reasoning?: string }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const ms = Date.now() - start;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || choice?.message?.reasoning || '';
    const usage = data.usage || {};

    // Calculate cost
    const modelInfo = this.models.find(m => m.id === model) || this.models[0]!;
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const cost = (promptTokens * modelInfo.inputCostPer1kTokens / 1000) +
                 (completionTokens * modelInfo.outputCostPer1kTokens / 1000);

    console.log(`[Mantle] ✅ ${model} → ${promptTokens + completionTokens} tokens, ${ms}ms, $${cost.toFixed(6)}`);

    return {
      id: data.id || `mantle-${randomUUID()}`,
      model,
      provider: 'mantle',
      role: 'assistant',
      content,
      finishReason: (choice?.finish_reason === 'stop' ? 'stop' : 'length') as 'stop' | 'length',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: usage.total_tokens || (promptTokens + completionTokens),
      },
      cost,
      metadata: { endpoint: 'bedrock-mantle', ms },
    };
  }

  /**
   * Streaming via SSE (Server-Sent Events) — falls back to non-streaming for now.
   */
  public async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    // For now, fall back to non-streaming (can be upgraded later)
    const response = await this.complete(request);
    yield {
      id: response.id,
      model: response.model,
      provider: 'mantle',
      delta: response.content,
      finishReason: response.finishReason,
      usage: response.usage,
    };
  }

  /**
   * Embeddings — not natively supported on Mantle chat endpoint.
   * Falls back to a text-based embedding approximation or throws.
   */
  public async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Bedrock Mantle chat endpoint doesn't support embeddings directly.
    // For RAG pipeline, use Supabase pgvector or a dedicated embedding endpoint.
    throw new Error('[Mantle] Embeddings not supported on chat/completions endpoint. Use Supabase pgvector for RAG.');
  }

  /**
   * Health check by pinging the fastest model.
   */
  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.complete({
        messages: [{ role: 'user', content: 'Say ok' }],
        model: 'nvidia.nemotron-nano-3-30b',
        maxTokens: 5,
      });

      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
        errorRate: 0,
        lastChecked: new Date(),
        consecutiveFailures: 0,
      };
    } catch {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        errorRate: 1,
        lastChecked: new Date(),
        consecutiveFailures: 1,
      };
    }
  }

  /**
   * Resolve which specialist model to use based on the request.
   * If a specific model is set (not 'auto'), use that directly.
   * Otherwise, this will be handled by the ModelRouter based on routingHints.
   */
  private resolveModel(request: CompletionRequest): string {
    if (request.model && request.model !== 'auto') {
      return request.model;
    }
    // Default to Mistral Large for general requests (best overall quality)
    return 'mistral.mistral-large-3-675b-instruct';
  }
}
