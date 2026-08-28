import type { MetricsConfig, MetricPoint } from './types.js';

/**
 * Collects and stores metrics data points.
 */
export class MetricsCollector {
  private readonly config: MetricsConfig;
  private readonly storage: Map<string, MetricPoint[]>;

  /**
   * Initializes a new MetricsCollector instance.
   * @param config - The configuration for the metrics collector.
   */
  constructor(config: MetricsConfig) {
    this.config = config;
    this.storage = new Map<string, MetricPoint[]>();
  }

  /**
   * Helper to construct the full metric name with prefix.
   */
  private getMetricName(name: string): string {
    return `${this.config.prefix}${name}`;
  }

  /**
   * Adds a metric point to internal storage.
   */
  private addPoint(point: MetricPoint): void {
    const points = this.storage.get(point.name) ?? [];
    points.push(point);
    this.storage.set(point.name, points);
  }

  /**
   * Increments a counter metric.
   * @param name - The metric name.
   * @param value - The value to increment by (default 1).
   * @param labels - Optional labels for dimensionality.
   */
  public increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.addPoint({
      name: this.getMetricName(name),
      type: 'counter',
      value,
      labels,
      timestamp: new Date(),
    });
  }

  /**
   * Records a value in a histogram.
   * @param name - The metric name.
   * @param value - The recorded value.
   * @param labels - Optional labels for dimensionality.
   */
  public record(name: string, value: number, labels: Record<string, string> = {}): void {
    this.addPoint({
      name: this.getMetricName(name),
      type: 'histogram',
      value,
      labels,
      timestamp: new Date(),
    });
  }

  /**
   * Sets the current value of a gauge.
   * @param name - The metric name.
   * @param value - The current value.
   * @param labels - Optional labels for dimensionality.
   */
  public gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    this.addPoint({
      name: this.getMetricName(name),
      type: 'gauge',
      value,
      labels,
      timestamp: new Date(),
    });
  }

  /**
   * Retrieves a snapshot of all recorded metrics.
   * @returns An array of all metric points.
   */
  public getMetrics(): MetricPoint[] {
    const allPoints: MetricPoint[] = [];
    for (const points of this.storage.values()) {
      allPoints.push(...points);
    }
    return allPoints;
  }

  /**
   * Retrieves metrics points filtered by name (without prefix).
   * @param name - The original metric name without the prefix.
   * @returns An array of matching metric points.
   */
  public getMetric(name: string): MetricPoint[] {
    const fullName = this.getMetricName(name);
    return this.storage.get(fullName) ?? [];
  }

  /**
   * Clears all recorded metrics.
   */
  public reset(): void {
    this.storage.clear();
  }
}
