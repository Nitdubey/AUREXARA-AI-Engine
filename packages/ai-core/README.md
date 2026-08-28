# @aurexara/ai-core

> Model Gateway, Provider Abstraction, and Intelligent Routing for the AUREXARA AI Engine

## Architecture

```
┌──────────────────────────────────────┐
│          ModelGateway                │
│   complete() | stream() | embed()   │
├──────────┬───────────────┬──────────┤
│  Router  │  FallbackChain│CostTrack │
├──────────┴───────────────┴──────────┤
│          ProviderRegistry           │
├─────────────────┬───────────────────┤
│  OpenAIProvider │ AnthropicProvider │
└─────────────────┴───────────────────┘
```

## Core Concepts

### Model Gateway

The `ModelGateway` is the single entry point for all AI model interactions. Every request flows through:

1. **Model Resolution** — If `model: 'auto'`, the `ModelRouter` scores all available models
2. **Provider Chain** — Ordered list of providers that support the requested model
3. **Fallback Execution** — Automatic retry with next provider on failure
4. **Cost Tracking** — Every request records token usage and cost

### Provider Adapters

Each provider implements `IAIProvider`:

```typescript
interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: readonly ModelCapabilities[];
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  healthCheck(): Promise<ProviderHealth>;
}
```

Adapters normalize provider-specific APIs (OpenAI, Anthropic) into a common interface.

### Intelligent Routing

The `ModelRouter` scores models based on:
- **Task type** — reasoning, coding, classification, generation
- **Latency target** — fast, balanced, quality
- **Cost target** — minimum, balanced, best
- **Required capabilities** — tool calling, structured output, vision, long context
- **Budget constraints** — prefer cheaper models when budget is tight

### Error Hierarchy

```
AIError (base)
├── ProviderError (retryable)
│   ├── RateLimitError (429, retryable)
│   ├── AuthenticationError (401/403, NOT retryable)
│   ├── TimeoutError (408/504, retryable)
│   ├── ContentFilteredError (NOT retryable)
│   └── ContextLengthExceededError (NOT retryable)
├── ValidationError (NOT retryable)
├── SchemaError (retryable)
├── NoAvailableProviderError (NOT retryable)
├── BudgetExceededError (NOT retryable)
└── ModelNotFoundError (NOT retryable)
```

## Supported Models

### OpenAI
| Model | Tier | Context | Tools | Vision | Cost (in/out per 1K) |
|---|---|---|---|---|---|
| gpt-4o | Premium | 128K | ✅ | ✅ | $0.0025 / $0.010 |
| gpt-4o-mini | Fast | 128K | ✅ | ✅ | $0.00015 / $0.0006 |
| gpt-4-turbo | Premium | 128K | ✅ | ✅ | $0.010 / $0.030 |
| o1 | Reasoning | 200K | ❌ | ❌ | $0.015 / $0.060 |
| o1-mini | Reasoning | 128K | ❌ | ❌ | $0.003 / $0.012 |

### Anthropic
| Model | Tier | Context | Tools | Vision | Cost (in/out per 1K) |
|---|---|---|---|---|---|
| claude-sonnet-4 | Premium | 200K | ✅ | ✅ | $0.003 / $0.015 |
| claude-3-5-haiku | Fast | 200K | ✅ | ❌ | $0.0008 / $0.004 |
| claude-opus-4 | Premium | 200K | ✅ | ✅ | $0.015 / $0.075 |

## Package Dependencies

- `openai` — OpenAI Node.js SDK
- `@anthropic-ai/sdk` — Anthropic Node.js SDK
- `zod` — Schema validation for structured output
- `@aurexara/observability` — Tracing and metrics
- `@aurexara/events` — Event bus integration
