import { describe, it, expect, beforeEach } from 'vitest';
import { CostTracker } from '../cost/tracker.js';
import { PricingRegistry } from '../cost/pricing.js';

describe('CostTracker and PricingRegistry', () => {
  let tracker: CostTracker;
  let registry: PricingRegistry;

  beforeEach(() => {
    registry = new PricingRegistry();
    tracker = new CostTracker(registry);
  });

  it('PricingRegistry defaults are registered', () => {
    const pricing = registry.get('gpt-4o');
    expect(pricing).toBeDefined();
    expect(pricing?.provider).toBe('openai');
  });

  it('PricingRegistry.calculateCost() — correct math', () => {
    const result = registry.calculateCost('gpt-4o', { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 });
    // input 0.0025 per 1k, output 0.01 per 1k
    expect(result.inputCost).toBeCloseTo(0.0025);
    expect(result.outputCost).toBeCloseTo(0.01);
    expect(result.totalCost).toBeCloseTo(0.0125);
  });

  it('CostTracker.record() — creates CostRecord', () => {
    const record = tracker.record({
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 }
    });
    
    expect(record.requestId).toBe('req-1');
    expect(record.provider).toBe('openai');
    expect(record.totalCost).toBeCloseTo(0.0125);
    expect(tracker.getRecords()).toHaveLength(1);
  });

  it('CostTracker.getTotalSpend() — sums correctly', () => {
    tracker.record({ requestId: 'req-1', provider: 'openai', model: 'gpt-4o', usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } });
    tracker.record({ requestId: 'req-2', provider: 'anthropic', model: 'claude-sonnet-4-20250514', usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } });
    
    // gpt-4o: 0.0125
    // claude: 0.003 + 0.015 = 0.018
    // Total = 0.0305
    expect(tracker.getTotalSpend()).toBeCloseTo(0.0305);
  });

  it('CostTracker.getSpendByProvider() — correct grouping', () => {
    tracker.record({ requestId: 'req-1', provider: 'openai', model: 'gpt-4o', usage: { promptTokens: 1000, completionTokens: 0, totalTokens: 1000 } });
    tracker.record({ requestId: 'req-2', provider: 'openai', model: 'gpt-4o', usage: { promptTokens: 0, completionTokens: 1000, totalTokens: 1000 } });
    tracker.record({ requestId: 'req-3', provider: 'anthropic', model: 'claude-sonnet-4-20250514', usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } });
    
    const byProvider = tracker.getSpendByProvider();
    expect(byProvider.get('openai')).toBeCloseTo(0.0125);
    expect(byProvider.get('anthropic')).toBeCloseTo(0.018);
  });

  it('CostTracker.checkBudget() — allowed/denied based on budget', () => {
    const usage = { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 };
    // gpt-4o cost for this usage is 0.0125
    
    const allowedResult = tracker.checkBudget('gpt-4o', usage, { maxCostPerRequest: 0.02 });
    expect(allowedResult.allowed).toBe(true);

    const deniedCostResult = tracker.checkBudget('gpt-4o', usage, { maxCostPerRequest: 0.01 });
    expect(deniedCostResult.allowed).toBe(false);

    const deniedTokensResult = tracker.checkBudget('gpt-4o', usage, { maxTokensPerRequest: 1000 });
    expect(deniedTokensResult.allowed).toBe(false);
  });

  it('CostTracker.reset() — clears records', () => {
    tracker.record({ requestId: 'req-1', provider: 'openai', model: 'gpt-4o', usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 } });
    tracker.reset();
    expect(tracker.getRecords()).toHaveLength(0);
    expect(tracker.getTotalSpend()).toBe(0);
  });
});
