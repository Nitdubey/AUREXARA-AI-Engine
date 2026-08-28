# @aurexara/engine

The main entry point for the AUREXARA AI Engine. This package wires together all underlying subsystems (`@aurexara/ai-core`, `@aurexara/events`, `@aurexara/observability`) into a cohesive, easy-to-use engine instance via dependency injection.

## Overview

The engine provides unified access to:
- **Models Gateway** (`models`): Intelligent routing, fallback, and cost tracking across AI providers.
- **Event Bus** (`events`): System-wide event pub/sub.
- **Observability** (`logger`, `tracer`, `metrics`): Structured logging, distributed tracing, and metrics collection.
- **Cost Tracking** (`costs`): Track token usage and costs across all model calls.

## Quick Start

```typescript
import { AurexaraEngine } from '@aurexara/engine';

// 1. Create engine from environment variables
const engine = AurexaraEngine.fromEnv('my-product');

// 2. Use the gateway to complete a request
const response = await engine.models.complete({
  model: 'auto', // Automatically routes to the best model
  messages: [{ role: 'user', content: 'Explain quantum computing in one sentence.' }]
});

console.log(response.content);
console.log(`Cost: $${response.cost}`);

// 3. Track total costs
console.log(`Total Spend: $${engine.costs.getTotalSpend()}`);
```

## Configuration

You can also construct the engine explicitly with full configuration:

```typescript
import { AurexaraEngine } from '@aurexara/engine';

const engine = AurexaraEngine.create({
  product: 'my-product',
  environment: 'production',
  providers: {
    openai: { apiKey: 'sk-...' },
    anthropic: { apiKey: 'sk-...' }
  },
  gateway: {
    defaultModel: 'auto',
    enableFallback: true,
    maxFallbackAttempts: 3
  },
  telemetry: {
    enabled: true,
    logLevel: 'info',
    traceExporter: 'console'
  }
});
```

## API Reference

### `models.complete(request: CompletionRequest): Promise<CompletionResponse>`
Generates a completion from the configured providers. Supports automatic fallback and intelligent routing.

### `models.stream(request: CompletionRequest): AIStream`
Returns a streaming response.

### `models.embed(request: EmbeddingRequest): Promise<EmbeddingResponse>`
Generates vector embeddings using available providers.

## Environment Variables

When using `AurexaraEngine.fromEnv()`, the following environment variables are read:

- `OPENAI_API_KEY`: API key for OpenAI
- `ANTHROPIC_API_KEY`: API key for Anthropic
- `GOOGLE_AI_API_KEY`: API key for Google (future)
- `AUREXARA_ENV`: `development`, `staging`, or `production`
- `AUREXARA_LOG_LEVEL`: `debug`, `info`, `warn`, `error`, `fatal`

## Architecture Notes

The `AurexaraEngine` implements a strict factory pattern. Dependencies are injected through its constructor, avoiding any hidden singletons or global state. All components (`Tracer`, `StructuredLogger`, `MetricsCollector`, `ModelGateway`, `CostTracker`, `ProviderRegistry`, `ModelRouter`) are instantiated within the static `create` method and passed to the internal constructor. This ensures high testability and clean architecture.
