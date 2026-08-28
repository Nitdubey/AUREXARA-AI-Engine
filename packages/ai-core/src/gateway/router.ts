import type { ModelCapabilities, RoutingHints } from '../types/models.js';
import type { CompletionRequest } from '../types/requests.js';

/** Scored model candidate. */
export interface ScoredModel {
  readonly model: ModelCapabilities;
  readonly score: number;
  readonly reasons: string[];
}

/**
 * Routes requests to optimal models based on routing hints.
 * Uses a scoring system that considers task type, latency, cost, and capabilities.
 */
export class ModelRouter {
  /**
   * Select the best model for a request.
   * @param models Available models from enabled providers
   * @param request The completion request (may contain routingHints)
   * @returns Scored and ranked models, best first
   */
  route(models: ModelCapabilities[], request: CompletionRequest): ScoredModel[] {
    // If a specific model is requested (not 'auto'), filter to that model
    // Otherwise, score all models
    const candidates = request.model && request.model !== 'auto'
      ? models.filter(m => m.id === request.model)
      : models;

    const hints = request.routingHints;
    const scored = candidates.map(model => this.scoreModel(model, hints, request));
    return scored.sort((a, b) => b.score - a.score);
  }

  private scoreModel(model: ModelCapabilities, hints: RoutingHints | undefined, request: CompletionRequest): ScoredModel {
    let score = 0;
    const reasons: string[] = [];

    // 1. Capability matching (hard requirements)
    if (hints?.requiredCapabilities) {
      for (const cap of hints.requiredCapabilities) {
        if (cap === 'tool_calling' && !model.supportsTools) return { model, score: -1000, reasons: ['Missing tool_calling'] };
        if (cap === 'structured_output' && !model.supportsStructuredOutput) return { model, score: -1000, reasons: ['Missing structured_output'] };
        if (cap === 'vision' && !model.supportsVision) return { model, score: -1000, reasons: ['Missing vision'] };
        if (cap === 'long_context' && model.contextWindow < 100000) return { model, score: -1000, reasons: ['Insufficient context window'] };
      }
      score += 10;
      reasons.push('All required capabilities met');
    }

    // 2. Tool requirement check
    if (request.tools && request.tools.length > 0 && !model.supportsTools) {
      return { model, score: -1000, reasons: ['Tools requested but not supported'] };
    }

    // 3. Structured output check
    if (request.responseFormat && !model.supportsStructuredOutput) {
      return { model, score: -500, reasons: ['Structured output requested but not supported'] };
    }

    // 4. Task type matching
    if (hints?.taskType) {
      score += this.scoreTaskType(model, hints.taskType);
      reasons.push(`Task type: ${hints.taskType}`);
    }

    // 5. Latency target
    if (hints?.latencyTarget) {
      score += this.scoreLatency(model, hints.latencyTarget);
      reasons.push(`Latency target: ${hints.latencyTarget}`);
    }

    // 6. Cost target
    if (hints?.costTarget) {
      score += this.scoreCost(model, hints.costTarget);
      reasons.push(`Cost target: ${hints.costTarget}`);
    }

    // 7. Budget constraint
    if (request.budget?.preferCheaper) {
      // Favor cheaper models
      const costFactor = 1 / (model.inputCostPer1kTokens + model.outputCostPer1kTokens + 0.001);
      score += Math.min(costFactor * 10, 20);
      reasons.push('Budget: prefer cheaper');
    }

    return { model, score, reasons };
  }

  private scoreTaskType(model: ModelCapabilities, taskType: string): number {
    // Reasoning tasks prefer reasoning-tier models
    // Coding tasks prefer premium models (Claude, GPT-4o)
    // Classification tasks prefer fast models
    // Generation tasks prefer balanced models
    // Map tier to task type affinity
    const tierScores: Record<string, Record<string, number>> = {
      reasoning: { reasoning: 30, fast: 0, balanced: 10, premium: 20 },
      coding: { reasoning: 15, fast: 5, balanced: 10, premium: 25 },
      generation: { reasoning: 5, fast: 15, balanced: 25, premium: 15 },
      classification: { reasoning: 0, fast: 30, balanced: 15, premium: 5 },
      embedding: { reasoning: 0, fast: 20, balanced: 20, premium: 0 },
    };
    return tierScores[taskType]?.[model.tier] ?? 10;
  }

  private scoreLatency(model: ModelCapabilities, target: string): number {
    const latencyScores: Record<string, Record<string, number>> = {
      fast: { fast: 25, balanced: 10, premium: 0, reasoning: -10 },
      balanced: { fast: 10, balanced: 25, premium: 15, reasoning: 5 },
      quality: { fast: 0, balanced: 10, premium: 25, reasoning: 20 },
    };
    return latencyScores[target]?.[model.tier] ?? 10;
  }

  private scoreCost(model: ModelCapabilities, target: string): number {
    const totalCostPer1k = model.inputCostPer1kTokens + model.outputCostPer1kTokens;
    if (target === 'minimum') {
      return totalCostPer1k < 0.002 ? 30 : totalCostPer1k < 0.02 ? 15 : 0;
    }
    if (target === 'balanced') {
      return totalCostPer1k < 0.02 ? 20 : totalCostPer1k < 0.05 ? 15 : 5;
    }
    if (target === 'best') {
      return totalCostPer1k > 0.01 ? 20 : 10; // Higher cost usually = better model
    }
    return 10;
  }
}
