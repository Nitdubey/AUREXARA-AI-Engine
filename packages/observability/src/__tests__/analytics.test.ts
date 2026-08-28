import { describe, it, expect } from 'vitest';
import { TraceAnalyzer } from '../analytics.js';
import { DashboardProvider } from '../dashboard.js';
import type { SpanData } from '../types.js';

function createMockSpan(overrides: Partial<SpanData> = {}): SpanData {
  return {
    id: 'span-' + Math.random().toString(36).substring(7),
    traceId: 'trace-1',
    name: 'test-span',
    type: 'agent_run',
    status: 'success',
    startedAt: new Date('2024-01-01T00:00:00Z'),
    attributes: {},
    children: [],
    ...overrides
  };
}

describe('TraceAnalyzer', () => {
  it('analyzes basic spans correctly', () => {
    const analyzer = new TraceAnalyzer();
    const spans: SpanData[] = [
      createMockSpan({ durationMs: 100 }),
      createMockSpan({ durationMs: 200, status: 'failure' })
    ];

    const result = analyzer.analyze(spans);
    expect(result.totalTraces).toBe(2);
    expect(result.totalSpans).toBe(2);
    expect(result.avgDurationMs).toBe(150);
    expect(result.successRate).toBe(0.5);
    expect(result.failureRate).toBe(0.5);
  });

  it('calculates percentiles correctly', () => {
    const analyzer = new TraceAnalyzer();
    const spans = Array.from({ length: 100 }).map((_, i) => createMockSpan({ durationMs: i + 1 }));
    
    const result = analyzer.analyze(spans);
    expect(result.p50DurationMs).toBeCloseTo(50.5, 0);
    expect(result.p95DurationMs).toBeCloseTo(95.05, 0);
    expect(result.p99DurationMs).toBeCloseTo(99.01, 0);
  });

  it('aggregates tokens and cost', () => {
    const analyzer = new TraceAnalyzer();
    const span = createMockSpan({
      tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      cost: 0.05
    });

    const result = analyzer.analyze([span]);
    expect(result.totalTokens).toBe(30);
    expect(result.totalCost).toBe(0.05);
  });

  it('gets slowest spans', () => {
    const analyzer = new TraceAnalyzer();
    const spans = [
      createMockSpan({ durationMs: 10 }),
      createMockSpan({ durationMs: 500 }),
      createMockSpan({ durationMs: 50 })
    ];

    const slowest = analyzer.getSlowestSpans(spans, 2);
    expect(slowest.length).toBe(2);
    expect(slowest[0]?.durationMs).toBe(500);
    expect(slowest[1]?.durationMs).toBe(50);
  });

  it('gets error spans', () => {
    const analyzer = new TraceAnalyzer();
    const spans = [
      createMockSpan({ status: 'success' }),
      createMockSpan({ status: 'failure', error: 'Boom' })
    ];

    const errors = analyzer.getErrorSpans(spans);
    expect(errors.length).toBe(1);
    expect(errors[0]?.error).toBe('Boom');
  });

  it('generates latency trends', () => {
    const analyzer = new TraceAnalyzer();
    const spans = [
      createMockSpan({ startedAt: new Date(1000), durationMs: 100 }),
      createMockSpan({ startedAt: new Date(1500), durationMs: 200 }),
      createMockSpan({ startedAt: new Date(5000), durationMs: 300 })
    ];

    const trends = analyzer.getLatencyTrend(spans, 2000);
    expect(trends.length).toBe(2);
    expect(trends[0]?.value).toBe(150); // Avg of 100 and 200
    expect(trends[1]?.value).toBe(300);
  });
});

describe('DashboardProvider', () => {
  it('generates dashboard data', () => {
    const provider = new DashboardProvider();
    const span = createMockSpan({
      type: 'model_call',
      attributes: { model: 'gpt-4' },
      durationMs: 100,
      status: 'failure',
      error: 'Timeout'
    });

    const data = provider.generateDashboard([span]);
    expect(data.health).toBe('unhealthy'); // 0% success
    expect(data.recentErrors.length).toBe(1);
    expect(data.recentErrors[0]?.error).toBe('Timeout');
    expect(data.topModels.length).toBe(1);
    expect(data.topModels[0]?.model).toBe('gpt-4');
  });

  it('determines health correctly', () => {
    const provider = new DashboardProvider();
    
    // Healthy
    const healthyData = provider.generateDashboard(
      Array.from({ length: 100 }).map(() => createMockSpan({ status: 'success' }))
    );
    expect(healthyData.health).toBe('healthy');

    // Degraded (80-95%)
    const degradedSpans = Array.from({ length: 90 }).map(() => createMockSpan({ status: 'success' }))
      .concat(Array.from({ length: 10 }).map(() => createMockSpan({ status: 'failure' })));
    const degradedData = provider.generateDashboard(degradedSpans);
    expect(degradedData.health).toBe('degraded');

    // Unhealthy (<80%)
    const unhealthySpans = Array.from({ length: 50 }).map(() => createMockSpan({ status: 'success' }))
      .concat(Array.from({ length: 50 }).map(() => createMockSpan({ status: 'failure' })));
    const unhealthyData = provider.generateDashboard(unhealthySpans);
    expect(unhealthyData.health).toBe('unhealthy');
  });
});
