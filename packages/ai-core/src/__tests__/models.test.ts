import { describe, it, expect, vi } from 'vitest';
import { ModelRegistry } from '../models/registry.js';
import type { ModelEntry } from '../models/registry.js';
import { ModelVersionManager } from '../models/versioning.js';
import type { ModelVersion } from '../models/versioning.js';
import { ABTestManager } from '../models/ab-testing.js';
import { FineTuneManager } from '../models/fine-tune.js';
import { ModelFallbackManager } from '../models/model-fallback.js';
import type { FallbackChainConfig } from '../models/model-fallback.js';
import { CustomModelProvider } from '../models/custom-provider.js';
import type { ModelCapabilities } from '../types/models.js';

// ─── Shared test data ───

const testCapabilities: ModelCapabilities = {
  id: 'test-model',
  provider: 'custom',
  displayName: 'Test Model',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  supportsTools: true,
  supportsStructuredOutput: true,
  supportsVision: false,
  supportsStreaming: true,
  inputCostPer1kTokens: 0.01,
  outputCostPer1kTokens: 0.03,
  tier: 'balanced',
};

const testModelEntry: ModelEntry = {
  capabilities: testCapabilities,
  status: 'available',
  origin: 'provider',
  version: '1.0.0',
  deployedAt: new Date(),
  tags: ['production', 'internal'],
  metadata: {},
};

describe('Models System Tests', () => {
  // ─── Model Registry ───

  describe('ModelRegistry', () => {
    it('register/get/remove works correctly', () => {
      const registry = new ModelRegistry();
      registry.register(testModelEntry);

      const retrieved = registry.get('test-model');
      expect(retrieved).toBeDefined();
      expect(retrieved!.capabilities.id).toBe('test-model');
      expect(retrieved!.status).toBe('available');

      const removed = registry.remove('test-model');
      expect(removed).toBe(true);
      expect(registry.get('test-model')).toBeUndefined();
    });

    it('search with query filters works', () => {
      const registry = new ModelRegistry();
      registry.register(testModelEntry);
      registry.register({
        ...testModelEntry,
        capabilities: { ...testCapabilities, id: 'model-2', tier: 'premium' },
        status: 'preview',
      });

      const balanced = registry.search({ tier: 'balanced' });
      expect(balanced).toHaveLength(1);
      expect(balanced[0]!.capabilities.id).toBe('test-model');

      const available = registry.listByStatus('available');
      expect(available).toHaveLength(1);

      const byProvider = registry.listByProvider('custom');
      expect(byProvider).toHaveLength(2);
    });

    it('updateStatus updates the status properly', () => {
      const registry = new ModelRegistry();
      registry.register(testModelEntry);

      registry.updateStatus('test-model', 'deprecated');
      expect(registry.get('test-model')!.status).toBe('deprecated');

      const availableIds = registry.getAvailableModelIds();
      expect(availableIds).not.toContain('test-model');
    });
  });

  // ─── Model Versioning ───

  describe('ModelVersionManager', () => {
    const testVersion: ModelVersion = {
      modelId: 'test-model',
      version: '1.0.0',
      capabilities: testCapabilities,
      releaseDate: new Date(),
      changelog: 'Initial release',
      isActive: true,
      isDeprecated: false,
    };

    it('registerVersion/getVersions works', () => {
      const manager = new ModelVersionManager();
      manager.registerVersion(testVersion);

      const versions = manager.getVersions('test-model');
      expect(versions).toHaveLength(1);
      expect(versions[0]!.version).toBe('1.0.0');
    });

    it('setActiveVersion works', () => {
      const manager = new ModelVersionManager();
      manager.registerVersion(testVersion);
      manager.registerVersion({
        ...testVersion,
        version: '1.1.0',
        isActive: false,
        changelog: 'Improvements',
      });

      manager.setActiveVersion('test-model', '1.1.0');
      const active = manager.getActiveVersion('test-model');
      expect(active).toBeDefined();
      expect(active!.version).toBe('1.1.0');
    });

    it('compareVersions works', () => {
      const manager = new ModelVersionManager();
      expect(manager.compareVersions('1.0.0', '1.0.0')).toBe('same');
      expect(manager.compareVersions('2.0.0', '1.0.0')).toBe('newer');
      expect(manager.compareVersions('1.0.0', '2.0.0')).toBe('older');
    });

    it('getVersionCount returns correct count', () => {
      const manager = new ModelVersionManager();
      manager.registerVersion(testVersion);
      manager.registerVersion({ ...testVersion, version: '1.1.0', isActive: false });
      expect(manager.getVersionCount('test-model')).toBe(2);
    });
  });

  // ─── A/B Testing ───

  describe('ABTestManager', () => {
    it('create/start experiment', () => {
      const manager = new ABTestManager();
      const exp = manager.createExperiment('Test', 'Testing', 'model-a', 'model-b', 50);
      expect(exp.id).toBeDefined();
      expect(exp.status).toBe('draft');

      manager.startExperiment(exp.id);
      const started = manager.getExperiment(exp.id);
      expect(started!.status).toBe('running');
    });

    it('selectVariant respects traffic split', () => {
      const manager = new ABTestManager();
      const exp = manager.createExperiment('Test', 'Testing', 'model-a', 'model-b', 50);
      manager.startExperiment(exp.id);

      // selectVariant returns { model, variant } for running experiments
      const selected = manager.selectVariant(exp.id);
      expect(selected).toBeDefined();
      expect(['model-a', 'model-b']).toContain(selected!.model);
      expect(['A', 'B']).toContain(selected!.variant);
    });

    it('selectVariant returns undefined for non-running', () => {
      const manager = new ABTestManager();
      const exp = manager.createExperiment('Test', 'Testing', 'model-a', 'model-b');
      // Still 'draft', not started
      expect(manager.selectVariant(exp.id)).toBeUndefined();
    });

    it('getStats returns correct stats', () => {
      const manager = new ABTestManager();
      const exp = manager.createExperiment('Test', 'Testing', 'model-a', 'model-b');
      manager.startExperiment(exp.id);

      manager.recordResult({
        experimentId: exp.id, requestId: 'r1',
        selectedModel: 'model-a', variant: 'A',
        latencyMs: 100, tokenCount: 50, cost: 0.01, timestamp: new Date(),
      });
      manager.recordResult({
        experimentId: exp.id, requestId: 'r2',
        selectedModel: 'model-b', variant: 'B',
        latencyMs: 200, tokenCount: 80, cost: 0.02, timestamp: new Date(),
      });

      const stats = manager.getStats(exp.id);
      expect(stats.totalRequests).toBe(2);
      expect(stats.variantARequests).toBe(1);
      expect(stats.variantBRequests).toBe(1);
      expect(stats.avgLatencyA).toBe(100);
      expect(stats.avgLatencyB).toBe(200);
    });
  });

  // ─── Fine-Tune Manager ───

  describe('FineTuneManager', () => {
    it('createJob/startJob/completeJob', () => {
      const manager = new FineTuneManager();
      const job = manager.createJob({
        name: 'test-finetune',
        baseModel: 'gpt-4o',
        provider: 'openai',
        trainingFile: 'data/train.jsonl',
      });

      expect(job.id).toBeDefined();
      expect(job.status).toBe('pending');

      manager.startJob(job.id);
      const started = manager.getJob(job.id);
      expect(started!.status).toBe('running');

      manager.completeJob(job.id, 'ft:gpt-4o:aurexara:2024', {
        trainingLoss: 0.05, trainedTokens: 50000, epochs: 3,
      });
      const completed = manager.getJob(job.id);
      expect(completed!.status).toBe('succeeded');
      expect(completed!.resultModel).toBe('ft:gpt-4o:aurexara:2024');
      expect(completed!.metrics!.trainingLoss).toBe(0.05);
    });

    it('cancelJob works', () => {
      const manager = new FineTuneManager();
      const job = manager.createJob({
        name: 'test-cancel',
        baseModel: 'gpt-4o',
        provider: 'openai',
        trainingFile: 'data/train.jsonl',
      });

      manager.cancelJob(job.id);
      const cancelled = manager.getJob(job.id);
      expect(cancelled!.status).toBe('cancelled');
    });

    it('getJobsByBaseModel filters correctly', () => {
      const manager = new FineTuneManager();
      manager.createJob({ name: 'j1', baseModel: 'gpt-4o', provider: 'openai', trainingFile: 'f1' });
      manager.createJob({ name: 'j2', baseModel: 'claude-3', provider: 'anthropic', trainingFile: 'f2' });

      expect(manager.getJobsByBaseModel('gpt-4o')).toHaveLength(1);
      expect(manager.getJobsByBaseModel('claude-3')).toHaveLength(1);
    });
  });

  // ─── Model Fallback ───

  describe('ModelFallbackManager', () => {
    it('registerChain/getNextModel', () => {
      const manager = new ModelFallbackManager();
      const chain: FallbackChainConfig = {
        id: 'chain-1',
        name: 'Primary Fallback',
        models: [
          { modelId: 'gpt-4o', priority: 1, triggers: ['error', 'timeout'], maxRetries: 2, timeoutMs: 5000 },
          { modelId: 'claude-3', priority: 2, triggers: ['error', 'rate_limit'], maxRetries: 1, timeoutMs: 3000 },
        ],
        maxAttempts: 3,
        enabled: true,
      };

      manager.registerChain(chain);
      expect(manager.getChain('chain-1')).toBeDefined();

      // getNextModel(chainId, trigger, attemptNumber)
      const next1 = manager.getNextModel('chain-1', 'error', 0);
      expect(next1).toBeDefined();
      expect(next1!.modelId).toBe('gpt-4o'); // priority 1

      const next2 = manager.getNextModel('chain-1', 'error', 1);
      expect(next2).toBeDefined();
      expect(next2!.modelId).toBe('claude-3'); // priority 2
    });

    it('setEnabled disables chain', () => {
      const manager = new ModelFallbackManager();
      manager.registerChain({
        id: 'chain-2', name: 'Test', maxAttempts: 2, enabled: true,
        models: [{ modelId: 'model-a', priority: 1, triggers: ['error'], maxRetries: 1, timeoutMs: 3000 }],
      });

      manager.setEnabled('chain-2', false);
      expect(manager.getNextModel('chain-2', 'error', 0)).toBeUndefined();
    });
  });

  // ─── Custom Model Provider ───

  describe('CustomModelProvider', () => {
    it('addModel/complete works', async () => {
      const provider = new CustomModelProvider('custom-corp', 'Custom Corp AI');

      provider.addModel({
        modelId: 'custom-llm-1',
        capabilities: { ...testCapabilities, id: 'custom-llm-1', provider: 'custom-corp' },
        endpoint: { baseUrl: 'https://api.custom-corp.com/v1' },
      });

      expect(provider.models).toHaveLength(1);
      expect(provider.getModelConfig('custom-llm-1')).toBeDefined();

      const response = await provider.complete({
        model: 'custom-llm-1',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response).toBeDefined();
      expect(response.content).toContain('custom-llm-1');
      expect(response.provider).toBe('custom-corp');
      expect(response.usage.totalTokens).toBe(30);
    });

    it('healthCheck returns healthy', async () => {
      const provider = new CustomModelProvider('test', 'Test');
      const health = await provider.healthCheck();
      expect(health.status).toBe('healthy');
      expect(health.latencyMs).toBeDefined();
    });
  });
});
