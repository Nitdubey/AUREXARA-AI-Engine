/** Error codes for the AI engine. */
export type AIErrorCode =
  | 'PROVIDER_ERROR'
  | 'RATE_LIMIT'
  | 'AUTHENTICATION_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'SCHEMA_ERROR'
  | 'NO_AVAILABLE_PROVIDER'
  | 'BUDGET_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'CONTENT_FILTERED'
  | 'CONTEXT_LENGTH_EXCEEDED'
  | 'STREAM_ERROR'
  | 'TOOL_EXECUTION_ERROR'
  | 'UNKNOWN';

/** Base error class for all AI engine errors. */
export class AIError extends Error {
  public readonly code: AIErrorCode;
  public readonly retryable: boolean;
  public readonly provider?: string;
  public readonly model?: string;
  public readonly metadata: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(params: {
    message: string;
    code: AIErrorCode;
    retryable?: boolean;
    provider?: string;
    model?: string;
    cause?: Error;
    metadata?: Record<string, unknown>;
  }) {
    super(params.message, { cause: params.cause });
    this.name = 'AIError';
    this.code = params.code;
    this.retryable = params.retryable ?? false;
    this.provider = params.provider;
    this.model = params.model;
    this.metadata = params.metadata ?? {};
    this.timestamp = new Date();
  }

  /** Create a JSON-serializable representation. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      provider: this.provider,
      model: this.model,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }
}
