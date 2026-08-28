import type { TokenUsage } from '../types/cost.js';

/** Pricing info for a single model. */
export interface ModelPricing {
  readonly modelId: string;
  readonly provider: string;
  readonly inputCostPer1kTokens: number;
  readonly outputCostPer1kTokens: number;
}

/**
 * Registry of model pricing data.
 * Used by the CostTracker to calculate per-request costs.
 */
export class PricingRegistry {
  private readonly prices = new Map<string, ModelPricing>();

  constructor() {
    this.registerDefaults();
  }

  /** Register pricing for a model. */
  register(pricing: ModelPricing): void {
    this.prices.set(pricing.modelId, pricing);
  }

  /** Get pricing for a model. Returns undefined if not found. */
  get(modelId: string): ModelPricing | undefined {
    return this.prices.get(modelId);
  }

  /** Calculate cost for a given model and token usage. */
  calculateCost(modelId: string, usage: TokenUsage): { inputCost: number; outputCost: number; totalCost: number } {
    const pricing = this.get(modelId);
    if (!pricing) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }
    const inputCost = (usage.promptTokens / 1000) * pricing.inputCostPer1kTokens;
    const outputCost = (usage.completionTokens / 1000) * pricing.outputCostPer1kTokens;
    return {
      inputCost,
      outputCost,
      totalCost: inputCost + outputCost,
    };
  }

  /** Register all default model prices. */
  private registerDefaults(): void {
    // OpenAI models
    this.register({ modelId: 'gpt-4o', provider: 'openai', inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01 });
    this.register({ modelId: 'gpt-4o-mini', provider: 'openai', inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006 });
    this.register({ modelId: 'gpt-4-turbo', provider: 'openai', inputCostPer1kTokens: 0.01, outputCostPer1kTokens: 0.03 });
    this.register({ modelId: 'o1', provider: 'openai', inputCostPer1kTokens: 0.015, outputCostPer1kTokens: 0.06 });
    this.register({ modelId: 'o1-mini', provider: 'openai', inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.012 });
    this.register({ modelId: 'text-embedding-3-small', provider: 'openai', inputCostPer1kTokens: 0.00002, outputCostPer1kTokens: 0 });
    this.register({ modelId: 'text-embedding-3-large', provider: 'openai', inputCostPer1kTokens: 0.00013, outputCostPer1kTokens: 0 });

    // Anthropic models
    this.register({ modelId: 'claude-sonnet-4-20250514', provider: 'anthropic', inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.015 });
    this.register({ modelId: 'claude-3-5-haiku-20241022', provider: 'anthropic', inputCostPer1kTokens: 0.0008, outputCostPer1kTokens: 0.004 });
    this.register({ modelId: 'claude-opus-4-20250514', provider: 'anthropic', inputCostPer1kTokens: 0.015, outputCostPer1kTokens: 0.075 });
  }
}
