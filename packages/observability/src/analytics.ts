import type { SpanData } from './types.js';

/** Aggregated statistics for a set of spans */
export interface TraceAnalytics {
  readonly totalTraces: number;
  readonly totalSpans: number;
  readonly avgDurationMs: number;
  readonly p50DurationMs: number;
  readonly p95DurationMs: number;
  readonly p99DurationMs: number;
  readonly successRate: number;
  readonly failureRate: number;
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly spanTypeBreakdown: Record<string, number>;
}

/** Time-series data point for trends */
export interface TimeSeriesPoint {
  readonly timestamp: Date;
  readonly value: number;
  readonly label?: string;
}

/**
 * Analyzes traces and spans for insights.
 */
export class TraceAnalyzer {
  /**
   * Compute aggregate analytics from a collection of root spans.
   * @param spans - The root spans to analyze.
   * @returns Aggregated trace analytics.
   */
  public analyze(spans: readonly SpanData[]): TraceAnalytics {
    const allSpans = this.flattenSpans(spans);
    
    let totalSpans = allSpans.length;
    let totalTraces = spans.length;
    let totalTokens = 0;
    let totalCost = 0;
    let successCount = 0;
    let failureCount = 0;
    const spanTypeBreakdown: Record<string, number> = {};
    const durations: number[] = [];

    for (const span of allSpans) {
      // Type breakdown
      spanTypeBreakdown[span.type] = (spanTypeBreakdown[span.type] || 0) + 1;
      
      // Tokens and cost
      if (span.tokenUsage) {
        totalTokens += span.tokenUsage.totalTokens;
      }
      if (span.cost) {
        totalCost += span.cost;
      }

      // Status
      if (span.status === 'success') {
        successCount++;
      } else if (span.status === 'failure') {
        failureCount++;
      }

      // Duration
      if (typeof span.durationMs === 'number') {
        durations.push(span.durationMs);
      }
    }

    // Rates
    const successRate = totalSpans > 0 ? successCount / totalSpans : 0;
    const failureRate = totalSpans > 0 ? failureCount / totalSpans : 0;

    // Percentiles and average
    durations.sort((a, b) => a - b);
    const avgDurationMs = durations.length > 0 
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
      : 0;
    const p50DurationMs = this.percentile(durations, 50);
    const p95DurationMs = this.percentile(durations, 95);
    const p99DurationMs = this.percentile(durations, 99);

    return {
      totalTraces,
      totalSpans,
      avgDurationMs,
      p50DurationMs,
      p95DurationMs,
      p99DurationMs,
      successRate,
      failureRate,
      totalTokens,
      totalCost,
      spanTypeBreakdown
    };
  }

  /**
   * Generate time series data for latency trends.
   * Groups spans into buckets by interval.
   * @param spans - The root spans to analyze.
   * @param intervalMs - The bucket interval in milliseconds.
   * @returns Array of time series points.
   */
  public getLatencyTrend(spans: readonly SpanData[], intervalMs: number): readonly TimeSeriesPoint[] {
    const allSpans = this.flattenSpans(spans);
    const buckets = new Map<number, number[]>();

    for (const span of allSpans) {
      if (typeof span.durationMs === 'number') {
        const bucketTime = Math.floor(span.startedAt.getTime() / intervalMs) * intervalMs;
        let bucket = buckets.get(bucketTime);
        if (!bucket) {
          bucket = [];
          buckets.set(bucketTime, bucket);
        }
        bucket.push(span.durationMs);
      }
    }

    const points: TimeSeriesPoint[] = [];
    for (const [bucketTime, durations] of buckets.entries()) {
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      points.push({
        timestamp: new Date(bucketTime),
        value: avg
      });
    }

    return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Find the slowest spans across all traces.
   * @param spans - The root spans.
   * @param topN - The number of slowest spans to return.
   * @returns The slowest spans, ordered descending by duration.
   */
  public getSlowestSpans(spans: readonly SpanData[], topN: number): readonly SpanData[] {
    const allSpans = this.flattenSpans(spans);
    const spansWithDuration = allSpans.filter(s => typeof s.durationMs === 'number');
    spansWithDuration.sort((a, b) => (b.durationMs as number) - (a.durationMs as number));
    return spansWithDuration.slice(0, topN);
  }

  /**
   * Find spans with errors.
   * @param spans - The root spans.
   * @returns Spans that have a failure status.
   */
  public getErrorSpans(spans: readonly SpanData[]): readonly SpanData[] {
    const allSpans = this.flattenSpans(spans);
    return allSpans.filter(s => s.status === 'failure');
  }

  /** Helper: compute percentile from sorted array */
  private percentile(sorted: readonly number[], p: number): number {
    if (sorted.length === 0) return 0;
    if (p <= 0) return sorted[0] ?? 0;
    if (p >= 100) return sorted[sorted.length - 1] ?? 0;

    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    const lowerVal = sorted[lower] ?? 0;
    const upperVal = upper >= sorted.length ? lowerVal : (sorted[upper] ?? lowerVal);
    return lowerVal * (1 - weight) + upperVal * weight;
  }

  /** Helper: flatten span tree into flat list */
  private flattenSpans(spans: readonly SpanData[]): SpanData[] {
    const flat: SpanData[] = [];
    const queue = [...spans];
    while (queue.length > 0) {
      const span = queue.shift();
      if (span) {
        flat.push(span);
        if (span.children && span.children.length > 0) {
          queue.push(...span.children);
        }
      }
    }
    return flat;
  }
}
