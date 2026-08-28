import { describe, it, expect, vi } from 'vitest';
import { AgentRunner } from '../runner.js';
import { ContextEngine } from '../context.js';
import { ToolRegistry } from '../tools/registry.js';
import { ToolExecutor } from '../tools/executor.js';
import { ConversationMemory } from '../memory/conversation.js';
import type { ModelGateway, CompletionRequest, CompletionResponse } from '@aurexara/ai-core';

describe('AgentRunner', () => {
  it('should run a simple agent loop without tools', async () => {
    // Mock the gateway
    const mockGateway: ModelGateway = {
      complete: vi.fn().mockResolvedValue({
        role: 'assistant',
        content: 'Hello, user!',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        cost: 0,
        latencyMs: 100,
        model: { id: 'test-model', tier: 'fast', inputCostPer1kTokens: 0, outputCostPer1kTokens: 0, contextWindow: 0, maxOutputTokens: 0, supportsTools: true, supportsStructuredOutput: false, supportsVision: false, supportsStreaming: false }
      } as CompletionResponse)
    } as unknown as ModelGateway;

    const registry = new ToolRegistry();
    const executor = new ToolExecutor(registry);
    const contextEngine = new ContextEngine();
    
    const runner = new AgentRunner(mockGateway, registry, executor, contextEngine);
    
    const memory = new ConversationMemory('session-1');
    
    const agent = {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'A test agent',
      systemPrompt: 'You are a test agent.',
      tools: [],
      model: 'auto',
      maxSteps: 5
    };

    const run = await runner.run(agent, 'Say hello', memory);

    expect(run.status).toBe('completed');
    expect(run.output).toBe('Hello, user!');
    expect(run.steps.length).toBe(1);
    expect(mockGateway.complete).toHaveBeenCalledTimes(1);
  });

  it('should handle tool execution loops', async () => {
    let callCount = 0;
    
    // Mock the gateway to request a tool on first call, and finish on second call
    const mockGateway: ModelGateway = {
      complete: vi.fn().mockImplementation(async (req: CompletionRequest) => {
        callCount++;
        if (callCount === 1) {
          return {
            role: 'assistant',
            content: null,
            toolCalls: [{ id: 'call_123', name: 'calculator', arguments: '{"operation":"add","a":2,"b":3}' }]
          } as CompletionResponse;
        } else {
          return {
            role: 'assistant',
            content: 'The answer is 5'
          } as CompletionResponse;
        }
      })
    } as unknown as ModelGateway;

    const registry = new ToolRegistry();
    registry.register({
      name: 'calculator',
      description: 'A calculator tool',
      inputSchema: {} as any
    }, async (args: any) => {
      if (args.operation === 'add') return args.a + args.b;
      return 0;
    });

    const executor = new ToolExecutor(registry);
    const contextEngine = new ContextEngine();
    
    const runner = new AgentRunner(mockGateway, registry, executor, contextEngine);
    const memory = new ConversationMemory('session-2');
    
    const agent = {
      id: 'agent-1',
      name: 'Math Agent',
      description: 'Does math',
      systemPrompt: 'You are a calculator.',
      tools: ['calculator'],
      model: 'auto',
      maxSteps: 5
    };

    const run = await runner.run(agent, 'What is 2 + 3?', memory);

    expect(run.status).toBe('completed');
    expect(run.output).toBe('The answer is 5');
    // Step 1: LLM call (returns tool call)
    // Step 2: Tool call execution
    // Step 3: LLM call (returns final answer)
    expect(run.steps.length).toBe(3);
    
    expect(run.steps[1]!.type).toBe('tool_call');
    expect(run.steps[1]!.output).toBe('5');
    expect(mockGateway.complete).toHaveBeenCalledTimes(2);
  });
});
