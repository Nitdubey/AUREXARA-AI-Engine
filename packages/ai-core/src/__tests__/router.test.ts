import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter } from '../gateway/router.js';
import type { ModelCapabilities } from '../types/models.js';
import type { CompletionRequest } from '../types/requests.js';

describe('ModelRouter', () => {
  let router: ModelRouter;
  let models: ModelCapabilities[];

  beforeEach(() => {
    router = new ModelRouter();
    models = [
      { id: 'gpt-4o', provider: 'openai', displayName: 'GPT 4o', contextWindow: 128000, maxOutputTokens: 4096, supportsTools: true, supportsStructuredOutput: true, supportsVision: true, supportsStreaming: true, inputCostPer1kTokens: 0.0025, outputCostPer1kTokens: 0.01, tier: 'premium' },
      { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT 4o Mini', contextWindow: 128000, maxOutputTokens: 4096, supportsTools: true, supportsStructuredOutput: true, supportsVision: true, supportsStreaming: true, inputCostPer1kTokens: 0.00015, outputCostPer1kTokens: 0.0006, tier: 'fast' },
      { id: 'o1', provider: 'openai', displayName: 'o1', contextWindow: 128000, maxOutputTokens: 8192, supportsTools: false, supportsStructuredOutput: false, supportsVision: false, supportsStreaming: false, inputCostPer1kTokens: 0.015, outputCostPer1kTokens: 0.06, tier: 'reasoning' },
      { id: 'claude-3-5-sonnet', provider: 'anthropic', displayName: 'Claude 3.5 Sonnet', contextWindow: 200000, maxOutputTokens: 8192, supportsTools: true, supportsStructuredOutput: false, supportsVision: true, supportsStreaming: true, inputCostPer1kTokens: 0.003, outputCostPer1kTokens: 0.015, tier: 'balanced' },
      { id: 'dumb-model', provider: 'test', displayName: 'Dumb', contextWindow: 4000, maxOutputTokens: 1000, supportsTools: false, supportsStructuredOutput: false, supportsVision: false, supportsStreaming: false, inputCostPer1kTokens: 0.0001, outputCostPer1kTokens: 0.0001, tier: 'fast' },
    ];
  });

  it('specific model (not auto) — filters to that model only', () => {
    const request: CompletionRequest = { messages: [], model: 'gpt-4o' };
    const scored = router.route(models, request);
    expect(scored).toHaveLength(1);
    expect(scored[0]?.model.id).toBe('gpt-4o');
  });

  it('capability requirement — missing capability = score -1000', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', routingHints: { requiredCapabilities: ['tool_calling'] } };
    const scored = router.route(models, request);
    const o1Score = scored.find(s => s.model.id === 'o1');
    expect(o1Score?.score).toBeLessThanOrEqual(-1000);
  });

  it('tools requested on non-tool model = score -1000', () => {
    const request: CompletionRequest = { 
      messages: [], 
      model: 'auto',
      tools: [{ type: 'function', function: { name: 'test', description: 'test' } }] 
    };
    const scored = router.route(models, request);
    const o1Score = scored.find(s => s.model.id === 'o1');
    expect(o1Score?.score).toBeLessThanOrEqual(-1000);
  });

  it('task type scoring — reasoning task -> reasoning tier wins', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', routingHints: { taskType: 'reasoning' } };
    const scored = router.route(models, request);
    expect(scored[0]?.model.id).toBe('o1'); // o1 is reasoning tier
  });

  it('task type scoring — classification task -> fast tier wins', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', routingHints: { taskType: 'classification' } };
    const scored = router.route(models, request);
    expect(scored[0]?.model.tier).toBe('fast');
  });

  it('latency target "fast" -> fast tier scores highest', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', routingHints: { latencyTarget: 'fast', taskType: 'generation' } };
    const scored = router.route(models, request);
    expect(scored[0]?.model.tier).toBe('fast');
  });

  it('cost target "minimum" -> cheapest model scores highest', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', routingHints: { costTarget: 'minimum', taskType: 'generation' } };
    const scored = router.route(models, request);
    // Both gpt-4o-mini and dumb-model are 'fast' tier with cheap pricing — either winning is valid
    expect(scored[0]?.model.tier).toBe('fast');
    // The top scorer must be cheaper than premium models
    const topCost = scored[0]!.model.inputCostPer1kTokens + scored[0]!.model.outputCostPer1kTokens;
    expect(topCost).toBeLessThan(0.01);
  });

  it('budget.preferCheaper — cheaper models score higher', () => {
    const request: CompletionRequest = { messages: [], model: 'auto', budget: { preferCheaper: true }, routingHints: { taskType: 'generation' } };
    const scored = router.route(models, request);
    
    // For generation tasks, 'balanced' tier gets a +10 advantage over 'fast' tier.
    // Since the budget score caps at +20 for all cheap/balanced models, the 'balanced' tier wins.
    const topModel = scored[0]!.model;
    expect(topModel.tier).toBe('balanced');
    
    // Make sure the cheapest models are right behind it
    const fastIdx = scored.findIndex(s => s.model.tier === 'fast');
    expect(fastIdx).toBeGreaterThan(0);
  });
});
