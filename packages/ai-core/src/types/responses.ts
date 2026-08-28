import type { Role, ToolCall } from './messages.js';
import type { TokenUsage } from './cost.js';

/** Reason the model stopped generating. */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter';

/** Response from a model completion. */
export interface CompletionResponse {
  readonly id: string;
  readonly content: string;
  readonly role: Role;
  readonly model: string;
  readonly provider: string;
  readonly usage: TokenUsage;
  readonly cost: number;
  readonly finishReason: FinishReason;
  readonly toolCalls?: ToolCall[];
  readonly metadata: Record<string, unknown>;
}

/** A chunk from a streaming completion. */
export interface StreamChunk {
  readonly id: string;
  readonly delta: string;
  readonly model: string;
  readonly provider: string;
  readonly finishReason?: FinishReason;
  readonly usage?: TokenUsage;
  readonly toolCalls?: ToolCall[];
}

/** Response from an embedding request. */
export interface EmbeddingResponse {
  readonly embeddings: readonly number[][];
  readonly model: string;
  readonly provider: string;
  readonly usage: TokenUsage;
  readonly cost: number;
  readonly dimensions: number;
}
