import { describe, it, expect } from 'vitest';
import { HeuristicEvaluator } from '../evaluation.js';

describe('HeuristicEvaluator', () => {
  it('should evaluate latency', async () => {
    const evaluator = new HeuristicEvaluator();
    
    const passResult = await evaluator.evaluate({}, {}, { durationMs: 150 }, {
      metric: 'latency',
      evaluator: 'heuristic',
      threshold: 200
    });
    expect(passResult.passed).toBe(true);
    
    const failResult = await evaluator.evaluate({}, {}, { durationMs: 250 }, {
      metric: 'latency',
      evaluator: 'heuristic',
      threshold: 200
    });
    expect(failResult.passed).toBe(false);
  });
  
  it('should evaluate cost', async () => {
    const evaluator = new HeuristicEvaluator();
    
    const passResult = await evaluator.evaluate({}, {}, { cost: 0.05 }, {
      metric: 'cost',
      evaluator: 'heuristic',
      threshold: 0.10
    });
    expect(passResult.passed).toBe(true);
  });
});
