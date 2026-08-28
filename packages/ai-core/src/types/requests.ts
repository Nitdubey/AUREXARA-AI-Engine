import type { Message, ToolDefinition } from './messages.js';
import type { RoutingHints } from './models.js';
import type { CostBudget, ResponseFormat } from './cost.js';

/** Request for a model completion. */
export interface CompletionRequest {
  readonly messages: Message[];
  readonly model?: string | 'auto';
  readonly routingHints?: RoutingHints;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stop?: string | string[];
  readonly tools?: ToolDefinition[];
  readonly responseFormat?: ResponseFormat;
  readonly timeout?: number;
  readonly budget?: CostBudget;
  readonly metadata?: Record<string, unknown>;
}

/** Request for generating embeddings. */
export interface EmbeddingRequest {
  readonly input: string | string[];
  readonly model?: string;
  readonly dimensions?: number;
}
