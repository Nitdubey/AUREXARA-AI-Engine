import type { EvalSuiteResult } from './evaluation-suite.js';

/** Regression detection configuration */
export interface RegressionConfig {
  readonly passRateDropThreshold: number;  // e.g. 0.05 means 5% drop triggers regression
  readonly scoreDropThreshold: number;     // e.g. 0.1 means 10% score drop
}

/** Result of a regression analysis */
export interface RegressionReport {
  readonly hasRegression: boolean;
  readonly regressions: readonly RegressionItem[];
  readonly improvements: readonly ImprovementItem[];
  readonly baselineRunAt: Date;
  readonly currentRunAt: Date;
}

export interface RegressionItem {
  readonly metric: string;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly dropPercent: number;
  readonly severity: 'warning' | 'critical';
}

export interface ImprovementItem {
  readonly metric: string;
  readonly baselineValue: number;
  readonly currentValue: number;
  readonly improvementPercent: number;
}

/**
 * Detects regressions by comparing two evaluation suite runs.
 */
export class RegressionDetector {
  /**
   * Initializes a new RegressionDetector.
   * @param config The configuration specifying thresholds for regression detection.
   */
  constructor(private readonly config: RegressionConfig) {}

  /**
   * Compare a current run against a baseline run.
   * Checks passRate and avgScore drops per metric.
   * @param baseline The baseline evaluation run to compare against.
   * @param current The current evaluation run.
   * @returns A detailed report of regressions and improvements.
   */
  compare(baseline: EvalSuiteResult, current: EvalSuiteResult): RegressionReport {
    const regressions: RegressionItem[] = [];
    const improvements: ImprovementItem[] = [];

    // Compare overall pass rate
    this._compareMetric(
      'overall_pass_rate',
      baseline.summary.passRate,
      current.summary.passRate,
      this.config.passRateDropThreshold,
      regressions,
      improvements
    );

    // Compare overall average score
    this._compareMetric(
      'overall_avg_score',
      baseline.summary.avgScore,
      current.summary.avgScore,
      this.config.scoreDropThreshold,
      regressions,
      improvements
    );

    // Compare individual metrics
    for (const [metric, baselineStats] of Object.entries(baseline.summary.metricBreakdown)) {
      const currentStats = current.summary.metricBreakdown[metric];
      if (!currentStats) {
        continue;
      }

      this._compareMetric(
        `metric_${metric}_pass_rate`,
        baselineStats.passRate,
        currentStats.passRate,
        this.config.passRateDropThreshold,
        regressions,
        improvements
      );

      this._compareMetric(
        `metric_${metric}_avg_score`,
        baselineStats.avgScore,
        currentStats.avgScore,
        this.config.scoreDropThreshold,
        regressions,
        improvements
      );
    }

    return {
      hasRegression: regressions.length > 0,
      regressions,
      improvements,
      baselineRunAt: baseline.ranAt,
      currentRunAt: current.ranAt,
    };
  }

  /**
   * Helper to compute the difference and register improvements or regressions.
   */
  private _compareMetric(
    metricName: string,
    baselineValue: number,
    currentValue: number,
    threshold: number,
    regressions: RegressionItem[],
    improvements: ImprovementItem[]
  ): void {
    const diff = currentValue - baselineValue;
    
    if (diff > 0) {
      const improvementPercent = baselineValue > 0 ? diff / baselineValue : (diff > 0 ? 1 : 0);
      improvements.push({
        metric: metricName,
        baselineValue,
        currentValue,
        improvementPercent,
      });
      return;
    }

    if (diff < 0) {
      const drop = Math.abs(diff);
      const dropPercent = baselineValue > 0 ? drop / baselineValue : drop;

      if (dropPercent > threshold) {
        regressions.push({
          metric: metricName,
          baselineValue,
          currentValue,
          dropPercent,
          severity: dropPercent > threshold * 2 ? 'critical' : 'warning',
        });
      }
    }
  }
}
