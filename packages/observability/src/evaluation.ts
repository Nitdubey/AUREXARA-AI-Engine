export interface EvaluationCriteria {
  readonly metric: 'accuracy' | 'relevance' | 'hallucination' | 'latency' | 'cost' | 'safety';
  readonly evaluator: 'llm_judge' | 'heuristic' | 'human';
  readonly threshold?: number;
}

export interface EvaluationResult {
  readonly metric: string;
  readonly score: number;
  readonly passed: boolean;
  readonly details?: string;
}

export interface Evaluator {
  evaluate(input: unknown, output: unknown, metadata: Record<string, unknown>, criteria: EvaluationCriteria): Promise<EvaluationResult>;
}

export class HeuristicEvaluator implements Evaluator {
  public async evaluate(_input: unknown, _output: unknown, metadata: Record<string, unknown>, criteria: EvaluationCriteria): Promise<EvaluationResult> {
    if (criteria.evaluator !== 'heuristic') {
      throw new Error('HeuristicEvaluator can only process heuristic criteria.');
    }

    if (criteria.metric === 'latency') {
      const durationMs = metadata['durationMs'] as number || 0;
      const passed = criteria.threshold !== undefined ? durationMs <= criteria.threshold : true;
      return {
        metric: 'latency',
        score: durationMs,
        passed,
        details: passed ? `Latency OK (${durationMs}ms)` : `Latency exceeded threshold (${durationMs}ms > ${criteria.threshold}ms)`
      };
    }

    if (criteria.metric === 'cost') {
      const cost = metadata['cost'] as number || 0;
      const passed = criteria.threshold !== undefined ? cost <= criteria.threshold : true;
      return {
        metric: 'cost',
        score: cost,
        passed,
        details: passed ? `Cost OK ($${cost})` : `Cost exceeded threshold ($${cost} > $${criteria.threshold})`
      };
    }

    throw new Error(`Unsupported heuristic metric: ${criteria.metric}`);
  }
}
