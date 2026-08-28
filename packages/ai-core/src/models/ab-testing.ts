import { randomUUID } from 'node:crypto';

/** A/B test experiment configuration */
export interface ABExperiment {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly modelA: string;  // Model ID
  readonly modelB: string;  // Model ID
  readonly trafficSplit: number; // 0-100, percentage going to model B
  readonly status: 'draft' | 'running' | 'paused' | 'completed';
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly metadata: Record<string, unknown>;
}

/** Result of a single A/B test evaluation */
export interface ABTestResult {
  readonly experimentId: string;
  readonly requestId: string;
  readonly selectedModel: string;  // Which model was selected
  readonly variant: 'A' | 'B';
  readonly latencyMs: number;
  readonly tokenCount: number;
  readonly cost: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, unknown>;
}

/** Aggregated experiment statistics */
export interface ExperimentStats {
  readonly experimentId: string;
  readonly totalRequests: number;
  readonly variantARequests: number;
  readonly variantBRequests: number;
  readonly avgLatencyA: number;
  readonly avgLatencyB: number;
  readonly avgCostA: number;
  readonly avgCostB: number;
  readonly totalCostA: number;
  readonly totalCostB: number;
}

/**
 * Manages A/B testing experiments for model comparison.
 */
export class ABTestManager {
  private readonly experiments = new Map<string, ABExperiment>();
  private readonly results = new Map<string, ABTestResult[]>();

  constructor() {}

  /**
   * Creates a new experiment.
   * 
   * @param name - The name of the experiment.
   * @param description - A description of the experiment.
   * @param modelA - The ID of model A.
   * @param modelB - The ID of model B.
   * @param trafficSplit - The percentage of traffic (0-100) that goes to model B. Defaults to 50.
   * @returns The created experiment.
   */
  public createExperiment(
    name: string,
    description: string,
    modelA: string,
    modelB: string,
    trafficSplit: number = 50
  ): ABExperiment {
    const experiment: ABExperiment = {
      id: randomUUID(),
      name,
      description,
      modelA,
      modelB,
      trafficSplit,
      status: 'draft',
      metadata: {}
    };

    this.experiments.set(experiment.id, experiment);
    this.results.set(experiment.id, []);
    return experiment;
  }

  /**
   * Starts an experiment.
   * 
   * @param experimentId - The ID of the experiment to start.
   */
  public startExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment && experiment.status !== 'running') {
      this.experiments.set(experimentId, {
        ...experiment,
        status: 'running',
        startedAt: new Date()
      });
    }
  }

  /**
   * Pauses a running experiment.
   * 
   * @param experimentId - The ID of the experiment to pause.
   */
  public pauseExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment && experiment.status === 'running') {
      this.experiments.set(experimentId, {
        ...experiment,
        status: 'paused'
      });
    }
  }

  /**
   * Completes an experiment.
   * 
   * @param experimentId - The ID of the experiment to complete.
   */
  public completeExperiment(experimentId: string): void {
    const experiment = this.experiments.get(experimentId);
    if (experiment && experiment.status !== 'completed') {
      this.experiments.set(experimentId, {
        ...experiment,
        status: 'completed',
        completedAt: new Date()
      });
    }
  }

  /**
   * Retrieves an experiment by its ID.
   * 
   * @param experimentId - The ID of the experiment to get.
   * @returns The experiment if found, undefined otherwise.
   */
  public getExperiment(experimentId: string): ABExperiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Lists experiments, optionally filtering by status.
   * 
   * @param status - The status to filter experiments by.
   * @returns A readonly array of matching experiments.
   */
  public listExperiments(status?: ABExperiment['status']): readonly ABExperiment[] {
    const allExps = Array.from(this.experiments.values());
    if (status) {
      return allExps.filter(exp => exp.status === status);
    }
    return allExps;
  }

  /**
   * Selects which model variant to use for a request.
   * Uses traffic split percentage.
   * Only selects from 'running' experiments.
   * 
   * @param experimentId - The ID of the experiment.
   * @returns An object containing the selected model and variant, or undefined if not running/found.
   */
  public selectVariant(experimentId: string): { model: string; variant: 'A' | 'B' } | undefined {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return undefined;
    }

    const roll = Math.random() * 100;
    if (roll < experiment.trafficSplit) {
      return { model: experiment.modelB, variant: 'B' };
    }
    return { model: experiment.modelA, variant: 'A' };
  }

  /**
   * Records a test result for an experiment.
   * 
   * @param result - The result to record.
   */
  public recordResult(result: ABTestResult): void {
    const results = this.results.get(result.experimentId);
    if (results) {
      results.push(result);
    }
  }

  /**
   * Gets aggregated statistics for an experiment.
   * 
   * @param experimentId - The ID of the experiment.
   * @returns The computed statistics for the experiment.
   */
  public getStats(experimentId: string): ExperimentStats {
    const results = this.results.get(experimentId) || [];
    
    let variantARequests = 0;
    let variantBRequests = 0;
    let totalLatencyA = 0;
    let totalLatencyB = 0;
    let totalCostA = 0;
    let totalCostB = 0;

    for (const res of results) {
      if (res.variant === 'A') {
        variantARequests++;
        totalLatencyA += res.latencyMs;
        totalCostA += res.cost;
      } else {
        variantBRequests++;
        totalLatencyB += res.latencyMs;
        totalCostB += res.cost;
      }
    }

    return {
      experimentId,
      totalRequests: results.length,
      variantARequests,
      variantBRequests,
      avgLatencyA: variantARequests > 0 ? totalLatencyA / variantARequests : 0,
      avgLatencyB: variantBRequests > 0 ? totalLatencyB / variantBRequests : 0,
      avgCostA: variantARequests > 0 ? totalCostA / variantARequests : 0,
      avgCostB: variantBRequests > 0 ? totalCostB / variantBRequests : 0,
      totalCostA,
      totalCostB
    };
  }
}
