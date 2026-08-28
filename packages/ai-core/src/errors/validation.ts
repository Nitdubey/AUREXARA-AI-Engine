import { AIError } from './base.js';

/** Input validation failure. */
export class ValidationError extends AIError {
  public readonly field?: string;
  public readonly constraint?: string;

  constructor(params: { message: string; field?: string; constraint?: string; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'VALIDATION_ERROR', retryable: false });
    this.name = 'ValidationError';
    this.field = params.field;
    this.constraint = params.constraint;
  }
}

/** Structured output schema validation failure. */
export class SchemaError extends AIError {
  public readonly schemaName?: string;
  public readonly violations?: readonly string[];

  constructor(params: { message: string; schemaName?: string; violations?: readonly string[]; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'SCHEMA_ERROR', retryable: true });
    this.name = 'SchemaError';
    this.schemaName = params.schemaName;
    this.violations = params.violations;
  }
}
