import type { Evaluator, EvaluationCriteria, EvaluationResult } from './evaluation.js';

/** A single test case for evaluation */
export interface EvalTestCase {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
  readonly expectedOutput?: unknown;
  readonly metadata?: Record<string, unknown>;
}

/** Configuration for running an evaluation suite */
export interface EvalSuiteConfig {
  readonly id: string;
  readonly name: string;
  readonly testCases: readonly EvalTestCase[];
  readonly criteria: readonly EvaluationCriteria[];
  readonly evaluators: Record<string, Evaluator>;
}

/** Result of a single test case evaluation */
export interface EvalCaseResult {
  readonly testCaseId: string;
  readonly testCaseName: string;
  readonly results: readonly EvaluationResult[];
  readonly allPassed: boolean;
  readonly durationMs: number;
}

/** Aggregate result of a full evaluation suite run */
export interface EvalSuiteResult {
  readonly suiteId: string;
  readonly suiteName: string;
  readonly caseResults: readonly EvalCaseResult[];
  readonly summary: EvalSummary;
  readonly ranAt: Date;
  readonly totalDurationMs: number;
}

/** Summary statistics for an evaluation suite */
export interface EvalSummary {
  readonly totalCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly passRate: number;
  readonly avgScore: number;
  readonly metricBreakdown: Record<string, { readonly avgScore: number; readonly passRate: number }>;
}

/**
 * Runs evaluation suites — batch evaluations across multiple test cases and criteria.
 */
export class EvalSuiteRunner {
  /**
   * Run a complete evaluation suite.
   * For each test case, run the output-generating function, then evaluate against all criteria.
   * @param config The suite configuration.
   * @param generateOutput A function that takes an input and returns the model's output.
   * @returns The complete suite results with summary statistics.
   */
  async run(
    config: EvalSuiteConfig,
    generateOutput: (input: unknown) => Promise<unknown>
  ): Promise<EvalSuiteResult> {
    const suiteStartTime = Date.now();
    const caseResults: EvalCaseResult[] = [];

    let totalScore = 0;
    let totalEvals = 0;
    let passedCases = 0;
    const metricStats: Record<string, { totalScore: number; evals: number; passed: number }> = {};

    for (const testCase of config.testCases) {
      const caseStartTime = Date.now();
      let output: unknown;
      
      try {
        output = await generateOutput(testCase.input);
      } catch (error) {
        output = error instanceof Error ? error.message : String(error);
      }

      const results: EvaluationResult[] = [];
      let allPassed = true;

      for (const criteria of config.criteria) {
        const evaluator = config.evaluators[criteria.evaluator];
        if (!evaluator) {
          throw new Error(`Evaluator '${criteria.evaluator}' not found in configuration.`);
        }

        const metadata: Record<string, unknown> = { ...testCase.metadata };
        if (testCase.expectedOutput !== undefined) {
          metadata.expectedOutput = testCase.expectedOutput;
        }

        try {
          const evalResult = await evaluator.evaluate(testCase.input, output, metadata, criteria);
          results.push(evalResult);

          if (!evalResult.passed) {
            allPassed = false;
          }

          totalScore += evalResult.score;
          totalEvals++;

          if (!metricStats[criteria.metric]) {
            metricStats[criteria.metric] = { totalScore: 0, evals: 0, passed: 0 };
          }
          const stat = metricStats[criteria.metric]!;
          stat.totalScore += evalResult.score;
          stat.evals++;
          if (evalResult.passed) {
            stat.passed++;
          }
        } catch (error) {
          allPassed = false;
          results.push({
            metric: criteria.metric,
            score: 0,
            passed: false,
            details: `Evaluator error: ${error instanceof Error ? error.message : String(error)}`,
          });
          
          if (!metricStats[criteria.metric]) {
            metricStats[criteria.metric] = { totalScore: 0, evals: 0, passed: 0 };
          }
          metricStats[criteria.metric]!.evals++;
        }
      }

      if (allPassed && results.length > 0) {
        passedCases++;
      }

      caseResults.push({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        results,
        allPassed: allPassed && results.length > 0,
        durationMs: Date.now() - caseStartTime,
      });
    }

    const totalCases = config.testCases.length;
    const failedCases = totalCases - passedCases;
    const passRate = totalCases > 0 ? passedCases / totalCases : 0;
    const avgScore = totalEvals > 0 ? totalScore / totalEvals : 0;

    const metricBreakdown: Record<string, { avgScore: number; passRate: number }> = {};
    for (const [metric, stats] of Object.entries(metricStats)) {
      metricBreakdown[metric] = {
        avgScore: stats.evals > 0 ? stats.totalScore / stats.evals : 0,
        passRate: stats.evals > 0 ? stats.passed / stats.evals : 0,
      };
    }

    const summary: EvalSummary = {
      totalCases,
      passedCases,
      failedCases,
      passRate,
      avgScore,
      metricBreakdown,
    };

    return {
      suiteId: config.id,
      suiteName: config.name,
      caseResults,
      summary,
      ranAt: new Date(),
      totalDurationMs: Date.now() - suiteStartTime,
    };
  }
}
