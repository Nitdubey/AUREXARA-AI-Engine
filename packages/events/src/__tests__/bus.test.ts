import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../bus.js';
import type { EngineEvent, ModelCalledEvent, AgentStartedEvent } from '../types.js';

describe('EventBus', () => {
  let bus: EventBus;
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = { error: vi.fn() };
    bus = new EventBus(mockLogger);
  });

  it('subscribe() and emit() — handler receives correct typed event', async () => {
    const handler = vi.fn();
    bus.subscribe('model.called', handler);

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: {
        requestId: 'test-123',
        provider: 'openai',
        model: 'gpt-4o',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        cost: 0.001,
        durationMs: 500,
        cached: false,
      },
      metadata: {
        timestamp: new Date(),
        traceId: 'trace-1',
      },
    };

    await bus.emit(event);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('subscribeAll() — wildcard handler receives all events', async () => {
    const wildcardHandler = vi.fn();
    bus.subscribeAll(wildcardHandler);

    const event1: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    const event2: AgentStartedEvent = {
      type: 'agent.started',
      data: { runId: 'run-1', agentId: 'agent-1', input: 'test' },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event1);
    await bus.emit(event2);

    expect(wildcardHandler).toHaveBeenCalledTimes(2);
    expect(wildcardHandler).toHaveBeenNthCalledWith(1, event1);
    expect(wildcardHandler).toHaveBeenNthCalledWith(2, event2);
  });

  it('emit() — handler errors are isolated (one failing does not block others)', async () => {
    const handler1 = vi.fn().mockRejectedValue(new Error('Handler 1 failed'));
    const handler2 = vi.fn();
    
    bus.subscribe('model.called', handler1);
    bus.subscribe('model.called', handler2);

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Event handler failed for event type: model.called', expect.any(Error));
  });

  it('unsubscribe — returned function removes handler', async () => {
    const handler = vi.fn();
    const unsubscribe = bus.subscribe('model.called', handler);

    unsubscribe();

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners() — clears everything', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    bus.subscribe('model.called', handler1);
    bus.subscribeAll(handler2);

    bus.removeAllListeners();

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event);
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('listenerCount() — correct counts with/without event type filter', () => {
    bus.subscribe('model.called', vi.fn());
    bus.subscribe('model.called', vi.fn());
    bus.subscribe('agent.started', vi.fn());
    bus.subscribeAll(vi.fn());

    expect(bus.listenerCount('model.called')).toBe(3); // 2 specific + 1 wildcard
    expect(bus.listenerCount('agent.started')).toBe(2); // 1 specific + 1 wildcard
    expect(bus.listenerCount()).toBe(4); // 3 specific + 1 wildcard
  });

  it('async handlers — promises are awaited', async () => {
    let resolved = false;
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      resolved = true;
    });

    bus.subscribe('model.called', handler);

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event);
    expect(resolved).toBe(true);
  });

  it('multiple handlers for same event type', async () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    bus.subscribe('model.called', handler1);
    bus.subscribe('model.called', handler2);

    const event: ModelCalledEvent = {
      type: 'model.called',
      data: { requestId: 'req-1', provider: 'openai', model: 'gpt-4', promptTokens: 10, completionTokens: 5, totalTokens: 15, cost: 0.01, durationMs: 100, cached: false },
      metadata: { timestamp: new Date() },
    };

    await bus.emit(event);
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});
