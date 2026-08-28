import { AIError } from './base.js';
import type { CostBudget } from '../types/cost.js';

/** Error thrown when no provider is available to fulfill a request. */
export class NoAvailableProviderError extends AIError {
  public readonly attemptedProviders: readonly string[];

  constructor(params: { message: string; attemptedProviders: readonly string[]; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'NO_AVAILABLE_PROVIDER', retryable: false });
    this.name = 'NoAvailableProviderError';
    this.attemptedProviders = params.attemptedProviders;
  }
}

/** Error thrown when a request exceeds the configured cost budget. */
export class BudgetExceededError extends AIError {
  public readonly budget: CostBudget;
  public readonly estimatedCost: number;

  constructor(params: { message: string; budget: CostBudget; estimatedCost: number; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'BUDGET_EXCEEDED', retryable: false });
    this.name = 'BudgetExceededError';
    this.budget = params.budget;
    this.estimatedCost = params.estimatedCost;
  }
}

/** Error thrown when a requested model is not found in the registry. */
export class ModelNotFoundError extends AIError {
  public readonly requestedModel: string;
  public readonly availableModels: readonly string[];

  constructor(params: { message: string; requestedModel: string; availableModels: readonly string[]; cause?: Error; metadata?: Record<string, unknown> }) {
    super({ ...params, code: 'MODEL_NOT_FOUND', retryable: false });
    this.name = 'ModelNotFoundError';
    this.requestedModel = params.requestedModel;
    this.availableModels = params.availableModels;
  }
}
