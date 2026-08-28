// Types
export type {
  Role, TextContent, ImageContent, MessageContent, ToolCall, Message, ToolDefinition,
  ModelTier, ModelCapabilities, RoutingHints, ProviderHealth, ProviderRegistryEntry,
  CompletionRequest, EmbeddingRequest,
  CompletionResponse, FinishReason, StreamChunk, EmbeddingResponse,
  TokenUsage, CostBudget, CostRecord, ResponseFormat,
} from './types/index.js';

// Errors  
export { AIError } from './errors/base.js';
export type { AIErrorCode } from './errors/base.js';
export { ProviderError, RateLimitError, AuthenticationError, TimeoutError, ContentFilteredError, ContextLengthExceededError } from './errors/provider.js';
export { ValidationError, SchemaError } from './errors/validation.js';
export { NoAvailableProviderError, BudgetExceededError, ModelNotFoundError } from './errors/routing.js';

// Providers
export type { IAIProvider, ProviderConfig } from './providers/interface.js';
// NOTE: Don't export concrete providers here — consumers import them directly if needed

// Gateway
export { ModelGateway } from './gateway/gateway.js';
export type { GatewayConfig } from './gateway/gateway.js';
export { ProviderRegistry } from './gateway/registry.js';
export { ModelRouter } from './gateway/router.js';
export type { ScoredModel } from './gateway/router.js';
export { FallbackChain } from './gateway/fallback.js';
export type { FallbackResult, FallbackAttempt } from './gateway/fallback.js';

// Cost
export { CostTracker } from './cost/tracker.js';
export { PricingRegistry } from './cost/pricing.js';
export type { BudgetCheckResult } from './cost/tracker.js';
export type { ModelPricing } from './cost/pricing.js';

// Streaming
export { AIStream } from './streaming/stream.js';

// Prompts
export * from './prompts/index.js';

// Models
export * from './models/index.js';
