import type { CostRecord, TokenUsage } from '../types/cost.js';
import { PricingRegistry } from './pricing.js';

/** Tenant-specific budget configuration */
export interface TenantBudget {
  readonly tenantId: string;
  readonly dailyLimit?: number;
  readonly weeklyLimit?: number;
  readonly monthlyLimit?: number;
  readonly maxCostPerRequest?: number;
  readonly maxTokensPerRequest?: number;
}

/** Result of a tenant budget check */
export interface TenantBudgetCheckResult {
  readonly allowed: boolean;
  readonly tenantId: string;
  readonly estimatedCost: number;
  readonly dailySpend: number;
  readonly weeklySpend: number;
  readonly monthlySpend: number;
  readonly violations: readonly string[];
}

/** Usage summary for a tenant */
export interface TenantUsageSummary {
  readonly tenantId: string;
  readonly totalSpend: number;
  readonly totalRequests: number;
  readonly spendByModel: Record<string, number>;
  readonly spendByProvider: Record<string, number>;
  readonly avgCostPerRequest: number;
}

/**
 * Tracks costs per tenant with multi-tenant budget enforcement.
 */
export class TenantCostTracker {
  private readonly pricing: PricingRegistry;
  private readonly records = new Map<string, CostRecord[]>();
  private readonly budgets = new Map<string, TenantBudget>();

  /**
   * Creates a new TenantCostTracker.
   * @param pricing Optional PricingRegistry to use for cost calculations.
   */
  constructor(pricing?: PricingRegistry) {
    this.pricing = pricing ?? new PricingRegistry();
  }

  /**
   * Set budget for a tenant.
   * @param budget The budget configuration for the tenant.
   */
  public setBudget(budget: TenantBudget): void {
    this.budgets.set(budget.tenantId, budget);
  }

  /**
   * Record a tenant's cost.
   * @param tenantId The ID of the tenant.
   * @param params The cost recording parameters.
   * @returns The newly created cost record.
   */
  public record(
    tenantId: string,
    params: { requestId: string; provider: string; model: string; usage: TokenUsage; metadata?: Record<string, unknown> }
  ): CostRecord {
    const { requestId, provider, model, usage, metadata } = params;
    const { inputCost, outputCost, totalCost } = this.pricing.calculateCost(model, usage);

    const record: CostRecord = {
      requestId,
      provider,
      model,
      usage,
      inputCost,
      outputCost,
      totalCost,
      timestamp: new Date(),
      metadata: { ...metadata, tenantId },
    };

    let tenantRecords = this.records.get(tenantId);
    if (!tenantRecords) {
      tenantRecords = [];
      this.records.set(tenantId, tenantRecords);
    }
    tenantRecords.push(record);

    return record;
  }

  /**
   * Check if a tenant's request is within budget.
   * @param tenantId The ID of the tenant.
   * @param model The model to be used.
   * @param estimatedTokens The estimated token usage.
   * @returns The result of the budget check.
   */
  public checkBudget(tenantId: string, model: string, estimatedTokens: TokenUsage): TenantBudgetCheckResult {
    const { totalCost: estimatedCost } = this.pricing.calculateCost(model, estimatedTokens);
    
    const dailySpend = this.getSpendSince(tenantId, this.getStartOfDay());
    const weeklySpend = this.getSpendSince(tenantId, this.getStartOfWeek());
    const monthlySpend = this.getSpendSince(tenantId, this.getStartOfMonth());

    const budget = this.budgets.get(tenantId);
    const violations: string[] = [];

    if (budget) {
      if (budget.dailyLimit !== undefined && dailySpend + estimatedCost > budget.dailyLimit) {
        violations.push(`Daily budget limit exceeded. Limit: ${budget.dailyLimit}, Current + Estimated: ${dailySpend + estimatedCost}`);
      }
      if (budget.weeklyLimit !== undefined && weeklySpend + estimatedCost > budget.weeklyLimit) {
        violations.push(`Weekly budget limit exceeded. Limit: ${budget.weeklyLimit}, Current + Estimated: ${weeklySpend + estimatedCost}`);
      }
      if (budget.monthlyLimit !== undefined && monthlySpend + estimatedCost > budget.monthlyLimit) {
        violations.push(`Monthly budget limit exceeded. Limit: ${budget.monthlyLimit}, Current + Estimated: ${monthlySpend + estimatedCost}`);
      }
      if (budget.maxCostPerRequest !== undefined && estimatedCost > budget.maxCostPerRequest) {
        violations.push(`Max cost per request exceeded. Limit: ${budget.maxCostPerRequest}, Estimated: ${estimatedCost}`);
      }
      if (budget.maxTokensPerRequest !== undefined && estimatedTokens.totalTokens > budget.maxTokensPerRequest) {
        violations.push(`Max tokens per request exceeded. Limit: ${budget.maxTokensPerRequest}, Estimated: ${estimatedTokens.totalTokens}`);
      }
    }

    return {
      allowed: violations.length === 0,
      tenantId,
      estimatedCost,
      dailySpend,
      weeklySpend,
      monthlySpend,
      violations,
    };
  }

  /**
   * Get usage summary for a tenant.
   * @param tenantId The ID of the tenant.
   * @returns The usage summary.
   */
  public getUsageSummary(tenantId: string): TenantUsageSummary {
    const tenantRecords = this.records.get(tenantId) ?? [];
    let totalSpend = 0;
    const spendByModel: Record<string, number> = {};
    const spendByProvider: Record<string, number> = {};

    for (const record of tenantRecords) {
      totalSpend += record.totalCost;
      spendByModel[record.model] = (spendByModel[record.model] ?? 0) + record.totalCost;
      spendByProvider[record.provider] = (spendByProvider[record.provider] ?? 0) + record.totalCost;
    }

    const totalRequests = tenantRecords.length;
    const avgCostPerRequest = totalRequests > 0 ? totalSpend / totalRequests : 0;

    return {
      tenantId,
      totalSpend,
      totalRequests,
      spendByModel,
      spendByProvider,
      avgCostPerRequest,
    };
  }

  /**
   * Get all records for a tenant.
   * @param tenantId The ID of the tenant.
   * @returns An array of cost records.
   */
  public getRecords(tenantId: string): readonly CostRecord[] {
    return this.records.get(tenantId) ?? [];
  }

  /**
   * Get tenant's spend in a time period.
   * @param tenantId The ID of the tenant.
   * @param since The start date to calculate spend from.
   * @returns The total spend since the given date.
   */
  private getSpendSince(tenantId: string, since: Date): number {
    const tenantRecords = this.records.get(tenantId) ?? [];
    let spend = 0;
    for (const record of tenantRecords) {
      if (record.timestamp >= since) {
        spend += record.totalCost;
      }
    }
    return spend;
  }

  /**
   * Get start of current day.
   * @returns The date representing the start of the current day.
   */
  private getStartOfDay(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /**
   * Get start of current week (Monday).
   * @returns The date representing the start of the current week.
   */
  private getStartOfWeek(): Date {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = startOfDay.getDay(); // 0 is Sunday, 1 is Monday
    const diff = startOfDay.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when Sunday
    return new Date(startOfDay.setDate(diff));
  }

  /**
   * Get start of current month.
   * @returns The date representing the start of the current month.
   */
  private getStartOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}
