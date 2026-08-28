import { describe, it, expect, vi } from 'vitest';
import { AgentTemplateRegistry } from '../agents/templates.js';
import { AgentStreamManager } from '../agents/streaming.js';
import { ConversationManager, InMemoryConversationStore } from '../agents/conversation-manager.js';
import type { ToolChainDefinition } from '../agents/tool-chain.js';
import { ToolChainExecutor } from '../agents/tool-chain.js';
import { AgentLifecycleManager } from '../agents/lifecycle.js';
import { AgentCoordinator } from '../agents/coordinator.js';
import type { Agent, AgentContext } from '../types.js';

// ─── Templates ───

describe('AgentTemplateRegistry', () => {
  it('registers defaults in constructor', () => {
    const registry = new AgentTemplateRegistry();
    // Constructor calls registerDefaults(), so templates should exist
    expect(registry.listAll().length).toBeGreaterThan(0);
    expect(registry.get('code-reviewer')).toBeDefined();
  });

  it('createFromTemplate() creates agent', () => {
    const registry = new AgentTemplateRegistry();
    const agent = registry.createFromTemplate('code-reviewer');
    expect(agent).toBeDefined();
    expect(agent.id).toBeDefined();
    expect(agent.name).toBeDefined();
    expect(agent.systemPrompt.length).toBeGreaterThan(0);
  });

  it('listByCategory() filters correctly', () => {
    const registry = new AgentTemplateRegistry();
    const codingTemplates = registry.listByCategory('coding');
    expect(codingTemplates.length).toBeGreaterThan(0);
    for (const t of codingTemplates) {
      expect(t.category).toBe('coding');
    }
  });

  it('searchByTag() finds templates', () => {
    const registry = new AgentTemplateRegistry();
    const all = registry.listAll();
    if (all.length > 0 && all[0]!.tags.length > 0) {
      const tag = all[0]!.tags[0]!;
      const found = registry.searchByTag(tag);
      expect(found.length).toBeGreaterThan(0);
    }
  });
});

// ─── Streaming ───

describe('AgentStreamManager', () => {
  it('subscribe/emit/unsubscribe', () => {
    const manager = new AgentStreamManager();
    const handler = vi.fn();
    const runId = 'run-1';

    const unsubscribe = manager.subscribe(runId, handler);

    // Emit takes a single AgentStreamEvent with a runId property
    const event = manager.createStartEvent('agent-1', runId);
    manager.emit(event);
    expect(handler).toHaveBeenCalledTimes(1);

    // Unsubscribe
    unsubscribe();
    manager.emit(manager.createEndEvent('agent-1', runId));
    expect(handler).toHaveBeenCalledTimes(1); // Should NOT be called again
  });

  it('buffers events', () => {
    const manager = new AgentStreamManager();
    const runId = 'run-2';

    manager.emit(manager.createStartEvent('agent-1', runId));
    manager.emit(manager.createTokenEvent('agent-1', runId, 'Hello', 'Hello'));
    manager.emit(manager.createEndEvent('agent-1', runId));

    const buffer = manager.getBuffer(runId);
    expect(buffer).toHaveLength(3);
    expect(buffer[0]!.type).toBe('stream_start');
    expect(buffer[2]!.type).toBe('stream_end');

    manager.clearBuffer(runId);
    expect(manager.getBuffer(runId)).toHaveLength(0);
  });
});

// ─── Conversation Manager ───

describe('ConversationManager & InMemoryConversationStore', () => {
  const mockRunner = {
    run: vi.fn().mockResolvedValue({
      id: 'run-1', agentId: 'agent-1', status: 'completed',
      input: {}, output: 'Hello back!', steps: [],
      context: { messages: [], availableTools: [], memory: {} },
      metadata: {}, createdAt: new Date()
    })
  } as any;

  const testAgent: Agent = {
    id: 'agent-1', name: 'TestAgent', description: 'Test',
    systemPrompt: 'You are helpful', tools: [], model: 'gpt-4o', maxSteps: 5
  };

  it('starts conversation', async () => {
    const store = new InMemoryConversationStore();
    // ConversationManager constructor: (agentRunner, store)
    const manager = new ConversationManager(mockRunner, store);

    const conv = await manager.startConversation(testAgent, 'Test Chat');
    expect(conv).toBeDefined();
    expect(conv.id).toBeDefined();
    expect(conv.agentId).toBe('agent-1');
    expect(conv.title).toBe('Test Chat');
    expect(conv.turns).toHaveLength(0);
  });

  it('store save/load/list/delete', async () => {
    const store = new InMemoryConversationStore();

    const conv = {
      id: 'c1', agentId: 'a1', title: 'Test',
      turns: [], createdAt: new Date(), updatedAt: new Date(), metadata: {}
    };

    await store.save(conv);
    expect(await store.load('c1')).toBeDefined();
    expect((await store.list('a1')).length).toBe(1);

    await store.delete('c1');
    expect(await store.load('c1')).toBeUndefined();
  });
});

// ─── Tool Chain ───

describe('ToolChainExecutor', () => {
  const mockContext: AgentContext = { messages: [], availableTools: [], memory: {} } as any;

  it('executes chain with step results', async () => {
    const executor = new ToolChainExecutor();
    executor.registerHandler('tool1', async (input) => `${input}-1`);
    executor.registerHandler('tool2', async (input) => `${input}-2`);

    const chain: ToolChainDefinition = {
      id: 'chain1', name: 'Chain', description: 'Test',
      steps: [
        { name: 'S1', toolName: 'tool1' },
        { name: 'S2', toolName: 'tool2' }
      ]
    };

    const res = await executor.execute(chain, 'start', mockContext);
    expect(res.success).toBe(true);
    expect(res.finalOutput).toBe('start-1-2');
    expect(res.steps).toHaveLength(2);
  });

  it('skips step when condition is false', async () => {
    const executor = new ToolChainExecutor();
    executor.registerHandler('tool1', async (input) => `${input}-1`);
    executor.registerHandler('tool2', async (input) => `${input}-2`);

    const chain: ToolChainDefinition = {
      id: 'chain1', name: 'Chain', description: 'Test',
      steps: [
        { name: 'S1', toolName: 'tool1', condition: () => false },
        { name: 'S2', toolName: 'tool2' }
      ]
    };

    const res = await executor.execute(chain, 'start', mockContext);
    expect(res.success).toBe(true);
    expect(res.steps[0]!.skipped).toBe(true);
    expect(res.finalOutput).toBe('start-2');
  });
});

// ─── Agent Lifecycle ───

describe('AgentLifecycleManager', () => {
  const agent: Agent = {
    id: 'agent-1', name: 'Agent', description: 'Test',
    systemPrompt: 'Sys', tools: [], model: 'test', maxSteps: 5
  };

  it('register/get/updateState/recordRun', () => {
    const manager = new AgentLifecycleManager();
    const managed = manager.register(agent);
    expect(managed.state).toBe('created');

    manager.updateState(agent.id, 'running');
    expect(manager.get(agent.id)?.state).toBe('running');

    manager.recordRun(agent.id, true);
    manager.recordRun(agent.id, false);
    expect(manager.get(agent.id)?.runCount).toBe(2);
    expect(manager.get(agent.id)?.errorCount).toBe(1);
  });

  it('getHealthMetrics', () => {
    const manager = new AgentLifecycleManager();
    manager.register(agent);
    manager.recordRun(agent.id, true);
    manager.recordRun(agent.id, false);
    manager.recordRun(agent.id, false);
    manager.recordRun(agent.id, true);

    const metrics = manager.getHealthMetrics(agent.id);
    expect(metrics).toBeDefined();
    expect(metrics?.totalRuns).toBe(4);
    expect(metrics?.errorRate).toBe(0.5);
    expect(metrics?.successRate).toBe(0.5);
  });

  it('listByState', () => {
    const manager = new AgentLifecycleManager();
    manager.register(agent);
    manager.updateState(agent.id, 'running');
    expect(manager.listByState('running')).toHaveLength(1);
    expect(manager.listByState('created')).toHaveLength(0);
  });

  it('deregister', () => {
    const manager = new AgentLifecycleManager();
    manager.register(agent);
    expect(manager.deregister(agent.id)).toBe(true);
    expect(manager.get(agent.id)).toBeUndefined();
  });
});

// ─── Agent Coordinator ───

describe('AgentCoordinator', () => {
  it('creates coordination result', async () => {
    const mockRunner = {
      run: vi.fn().mockResolvedValue({
        id: 'run-1', agentId: 'agent-1', status: 'completed',
        input: {}, output: 'done', steps: [],
        context: { messages: [], availableTools: [], memory: {} },
        metadata: {}, createdAt: new Date()
      })
    } as any;

    const coordinator = new AgentCoordinator(mockRunner);
    const supervisorAgent: Agent = {
      id: 'sup-1', name: 'Supervisor', description: 'Supervises',
      systemPrompt: 'Plan tasks', tools: [], model: 'gpt-4o', maxSteps: 5
    };
    const workerAgent: Agent = {
      id: 'work-1', name: 'Worker', description: 'Executes',
      systemPrompt: 'Do work', tools: [], model: 'gpt-4o', maxSteps: 5
    };

    const team = [
      { agent: supervisorAgent, role: 'supervisor' as const, capabilities: ['planning'] },
      { agent: workerAgent, role: 'worker' as const, capabilities: ['coding'] },
    ];
    const mockMemory = { addMessage: vi.fn(), getMessages: vi.fn().mockReturnValue([]), clear: vi.fn() } as any;

    const result = await coordinator.coordinate(team, 'Build something', mockMemory);
    expect(result).toBeDefined();
    expect(result.teamId).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
