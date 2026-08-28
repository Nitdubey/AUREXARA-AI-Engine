import type { CostRecord, TokenUsage, CostBudget } from '../types/cost.js';
import { PricingRegistry } from './pricing.js';

/** Result of a budget check. */
export interface BudgetCheckResult {
  readonly allowed: boolean;
  readonly estimatedCost: number;
  readonly budgetRemaining?: number;
  readonly reason?: string;
}

/**
 * Tracks costs across requests.
 * Injectable — takes a PricingRegistry in constructor.
 */
export class CostTracker {
  private readonly pricing: PricingRegistry;
  private readonly records: CostRecord[] = [];

  constructor(pricing?: PricingRegistry) {
    this.pricing = pricing ?? new PricingRegistry();
  }

  /** Record a completed request's cost. */
  record(params: { requestId: string; provider: string; model: string; usage: TokenUsage; metadata?: Record<string, unknown> }): CostRecord {
    const { inputCost, outputCost, totalCost } = this.pricing.calculateCost(params.model, params.usage);
    
    const record: CostRecord = {
      requestId: params.requestId,
      provider: params.provider,
      model: params.model,
      usage: params.usage,
      inputCost,
      outputCost,
      totalCost,
      timestamp: new Date(),
      metadata: params.metadata,
    };
    
    this.records.push(record);
    return record;
  }

  /** Check if a request is within budget. */
  checkBudget(model: string, estimatedTokens: TokenUsage, budget: CostBudget): BudgetCheckResult {
    const { totalCost } = this.pricing.calculateCost(model, estimatedTokens);
    
    if (budget.maxCostPerRequest !== undefined && totalCost > budget.maxCostPerRequest) {
      return {
        allowed: false,
        estimatedCost: totalCost,
        budgetRemaining: Math.max(0, budget.maxCostPerRequest - totalCost),
        reason: `Estimated cost ${totalCost} exceeds maxCostPerRequest ${budget.maxCostPerRequest}`,
      };
    }
    
    if (budget.maxTokensPerRequest !== undefined && estimatedTokens.totalTokens > budget.maxTokensPerRequest) {
      return {
        allowed: false,
        estimatedCost: totalCost,
        reason: `Estimated tokens ${estimatedTokens.totalTokens} exceeds maxTokensPerRequest ${budget.maxTokensPerRequest}`,
      };
    }
    
    return {
      allowed: true,
      estimatedCost: totalCost,
      budgetRemaining: budget.maxCostPerRequest !== undefined ? Math.max(0, budget.maxCostPerRequest - totalCost) : undefined,
    };
  }

  /** Get total spend. */
  getTotalSpend(): number {
    return this.records.reduce((sum, r) => sum + r.totalCost, 0);
  }

  /** Get spend by provider. */
  getSpendByProvider(): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of this.records) {
      const current = map.get(r.provider) ?? 0;
      map.set(r.provider, current + r.totalCost);
    }
    return map;
  }

  /** Get spend by model. */
  getSpendByModel(): Map<string, number> {
    const map = new Map<string, number>();
    for (const r of this.records) {
      const current = map.get(r.model) ?? 0;
      map.set(r.model, current + r.totalCost);
    }
    return map;
  }

  /** Get all records. */
  getRecords(): readonly CostRecord[] {
    return this.records;
  }

  /** Get records for a time period. */
  getRecordsSince(since: Date): readonly CostRecord[] {
    return this.records.filter(r => r.timestamp >= since);
  }

  /** Reset all records. */
  reset(): void {
    this.records.length = 0;
  }
}
