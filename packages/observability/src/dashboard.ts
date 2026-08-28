import type { SpanData } from './types.js';
import type { TraceAnalytics } from './analytics.js';
import { TraceAnalyzer } from './analytics.js';

/** Health status of the system */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** Dashboard overview data */
export interface DashboardData {
  readonly health: HealthStatus;
  readonly analytics: TraceAnalytics;
  readonly recentErrors: readonly ErrorSummary[];
  readonly topModels: readonly ModelUsage[];
  readonly generatedAt: Date;
}

export interface ErrorSummary {
  readonly spanId: string;
  readonly spanName: string;
  readonly error: string;
  readonly occurredAt: Date;
}

export interface ModelUsage {
  readonly model: string;
  readonly requestCount: number;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly avgLatencyMs: number;
}

/**
 * Generates dashboard-ready data from spans.
 */
export class DashboardProvider {
  private readonly analyzer: TraceAnalyzer;

  constructor(analyzer?: TraceAnalyzer) {
    this.analyzer = analyzer ?? new TraceAnalyzer();
  }

  /**
   * Generate complete dashboard data.
   * @param spans - The root spans to analyze.
   * @returns Dashboard overview data.
   */
  public generateDashboard(spans: readonly SpanData[]): DashboardData {
    const analytics = this.analyzer.analyze(spans);
    const health = this.determineHealth(analytics);
    
    // Recent errors
    const errorSpans = this.analyzer.getErrorSpans(spans);
    // Sort descending by start time to get most recent
    const sortedErrors = [...errorSpans].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    const recentErrors: ErrorSummary[] = sortedErrors.slice(0, 10).map(s => ({
      spanId: s.id,
      spanName: s.name,
      error: s.error || 'Unknown error',
      occurredAt: s.startedAt
    }));

    // Top models
    const topModels = this.computeTopModels(spans);

    return {
      health,
      analytics,
      recentErrors,
      topModels,
      generatedAt: new Date()
    };
  }

  /**
   * Determine system health from analytics.
   */
  private determineHealth(analytics: TraceAnalytics): HealthStatus {
    if (analytics.totalSpans === 0) return 'healthy';
    if (analytics.successRate > 0.95) return 'healthy';
    if (analytics.successRate > 0.8) return 'degraded';
    return 'unhealthy';
  }

  /** Helper to compute model usage stats */
  private computeTopModels(spans: readonly SpanData[]): ModelUsage[] {
    const flatSpans: SpanData[] = [];
    const queue = [...spans];
    while (queue.length > 0) {
      const span = queue.shift();
      if (span) {
        flatSpans.push(span);
        if (span.children && span.children.length > 0) {
          queue.push(...span.children);
        }
      }
    }

    const modelSpans = flatSpans.filter(s => s.type === 'model_call' && typeof s.attributes['model'] === 'string');
    
    const usageByModel = new Map<string, { count: number, tokens: number, cost: number, durations: number[] }>();

    for (const span of modelSpans) {
      const model = span.attributes['model'] as string;
      const usage = usageByModel.get(model) ?? { count: 0, tokens: 0, cost: 0, durations: [] };
      
      usage.count += 1;
      if (span.tokenUsage) {
        usage.tokens += span.tokenUsage.totalTokens;
      }
      if (span.cost) {
        usage.cost += span.cost;
      }
      if (typeof span.durationMs === 'number') {
        usage.durations.push(span.durationMs);
      }

      usageByModel.set(model, usage);
    }

    const models: ModelUsage[] = [];
    for (const [model, stats] of usageByModel.entries()) {
      const avgLatencyMs = stats.durations.length > 0
        ? stats.durations.reduce((a, b) => a + b, 0) / stats.durations.length
        : 0;

      models.push({
        model,
        requestCount: stats.count,
        totalTokens: stats.tokens,
        totalCost: stats.cost,
        avgLatencyMs
      });
    }

    // Sort by count descending
    return models.sort((a, b) => b.requestCount - a.requestCount);
  }
}
