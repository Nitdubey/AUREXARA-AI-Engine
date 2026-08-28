import { describe, it, expect, vi } from 'vitest';
import { TenantCostTracker } from '../cost/tenant-tracker.js';
import { CostAlertManager } from '../cost/alerts.js';
import type { CostRecord } from '../types/cost.js';

describe('TenantCostTracker', () => {
  it('tracks per-tenant costs', () => {
    const tracker = new TenantCostTracker();

    // Record costs for two tenants using a known model (gpt-4o)
    tracker.record('tenant-1', {
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
    });

    tracker.record('tenant-2', {
      requestId: 'req-2',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 500, completionTokens: 500, totalTokens: 1000 },
    });

    const summary1 = tracker.getUsageSummary('tenant-1');
    expect(summary1.totalSpend).toBeGreaterThan(0);
    expect(summary1.totalRequests).toBe(1);
    expect(summary1.spendByModel['gpt-4o']).toBeGreaterThan(0);

    const summary2 = tracker.getUsageSummary('tenant-2');
    expect(summary2.totalSpend).toBeGreaterThan(0);
    expect(summary2.totalRequests).toBe(1);

    // tenant-1 used 2x the tokens, should cost ~2x
    expect(summary1.totalSpend).toBeGreaterThan(summary2.totalSpend);
  });

  it('enforces daily limit', () => {
    const tracker = new TenantCostTracker();

    tracker.setBudget({
      tenantId: 'tenant-1',
      dailyLimit: 0.001, // Very small daily limit
    });

    // Record a cost that will exceed the limit
    tracker.record('tenant-1', {
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
    });

    // Check budget for another request — should be denied
    const check = tracker.checkBudget('tenant-1', 'gpt-4o', {
      promptTokens: 1000,
      completionTokens: 1000,
      totalTokens: 2000,
    });
    expect(check.allowed).toBe(false);
    expect(check.violations.length).toBeGreaterThan(0);
    expect(check.violations[0]).toContain('Daily');
  });

  it('gets correct usage summary', () => {
    const tracker = new TenantCostTracker();

    tracker.record('tenant-1', {
      requestId: 'req-1',
      provider: 'openai',
      model: 'gpt-4o',
      usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
    });
    tracker.record('tenant-1', {
      requestId: 'req-2',
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      usage: { promptTokens: 500, completionTokens: 500, totalTokens: 1000 },
    });

    const summary = tracker.getUsageSummary('tenant-1');
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalSpend).toBeGreaterThan(0);
    expect(summary.spendByProvider['openai']).toBeGreaterThan(0);
    expect(summary.spendByProvider['anthropic']).toBeGreaterThan(0);
    expect(summary.avgCostPerRequest).toBeCloseTo(summary.totalSpend / 2);
  });
});

describe('CostAlertManager', () => {
  it('triggers alerts when threshold exceeded', () => {
    const manager = new CostAlertManager();
    const callback = vi.fn();
    manager.onAlert(callback);

    manager.addRule({
      id: 'rule-1',
      name: 'High cost alert',
      threshold: 0.001, // Very small threshold
      period: 'daily',
      severity: 'critical',
    });

    // Create a cost record that exceeds threshold
    const records: CostRecord[] = [
      {
        requestId: 'req-1',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 10000, completionTokens: 10000, totalTokens: 20000 },
        inputCost: 0.025,
        outputCost: 0.1,
        totalCost: 0.125,
        timestamp: new Date(),
      },
    ];

    const alerts = manager.evaluate(records);
    expect(alerts.length).toBeGreaterThan(0);
    expect(callback).toHaveBeenCalled();
    expect(alerts[0]!.ruleId).toBe('rule-1');
    expect(alerts[0]!.severity).toBe('critical');
  });

  it('filters alerts by severity', () => {
    const manager = new CostAlertManager();

    manager.addRule({
      id: 'rule-1',
      name: 'Critical alert',
      threshold: 0.001,
      period: 'daily',
      severity: 'critical',
    });
    manager.addRule({
      id: 'rule-2',
      name: 'Warning alert',
      threshold: 0.001,
      period: 'daily',
      severity: 'warning',
    });

    const records: CostRecord[] = [
      {
        requestId: 'req-1',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
        inputCost: 0.01,
        outputCost: 0.01,
        totalCost: 0.02,
        timestamp: new Date(),
      },
    ];

    manager.evaluate(records);

    const criticalAlerts = manager.getAlertsBySeverity('critical');
    expect(criticalAlerts.length).toBe(1);
    expect(criticalAlerts[0]!.ruleId).toBe('rule-1');

    const warningAlerts = manager.getAlertsBySeverity('warning');
    expect(warningAlerts.length).toBe(1);
    expect(warningAlerts[0]!.ruleId).toBe('rule-2');

    const infoAlerts = manager.getAlertsBySeverity('info');
    expect(infoAlerts.length).toBe(0);
  });

  it('clears alerts', () => {
    const manager = new CostAlertManager();
    const callback = vi.fn();
    manager.onAlert(callback);

    manager.addRule({
      id: 'rule-1',
      name: 'Test alert',
      threshold: 0.001,
      period: 'daily',
      severity: 'warning',
    });

    const records: CostRecord[] = [
      {
        requestId: 'req-1',
        provider: 'openai',
        model: 'gpt-4o',
        usage: { promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 },
        inputCost: 0.01,
        outputCost: 0.01,
        totalCost: 0.02,
        timestamp: new Date(),
      },
    ];

    manager.evaluate(records);
    expect(callback).toHaveBeenCalled();
    expect(manager.getAlerts().length).toBeGreaterThan(0);

    manager.clearAlerts();
    expect(manager.getAlerts().length).toBe(0);
  });
});
