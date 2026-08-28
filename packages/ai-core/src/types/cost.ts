/** Token usage for a single request. */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/** Budget constraints for a request. */
export interface CostBudget {
  readonly maxCostPerRequest?: number;
  readonly maxTokensPerRequest?: number;
  readonly preferCheaper?: boolean;
}

/** Recorded cost for a completed request. */
export interface CostRecord {
  readonly requestId: string;
  readonly provider: string;
  readonly model: string;
  readonly usage: TokenUsage;
  readonly inputCost: number;
  readonly outputCost: number;
  readonly totalCost: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/** Format specification for structured output. */
export interface ResponseFormat {
  readonly type: 'json_object' | 'json_schema';
  readonly schema?: Record<string, unknown>;
  readonly name?: string;
  readonly strict?: boolean;
}
