import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Tracer } from '../tracer.js';
import { Span } from '../span.js';
import type { SpanExporter, SpanData } from '../types.js';

class MockExporter implements SpanExporter {
  name = 'MockExporter';
  export = vi.fn(async () => {});
}

describe('Tracer and Span', () => {
  let exporter: MockExporter;
  let tracer: Tracer;

  beforeEach(() => {
    exporter = new MockExporter();
    tracer = new Tracer({
      serviceName: 'test-service',
      environment: 'test',
      exporters: [exporter],
    });
  });

  it('startSpan() — creates span with correct properties', () => {
    const span = tracer.startSpan('my-operation', 'agent');
    expect(span).toBeInstanceOf(Span);
    expect(span.name).toBe('my-operation');
    expect(span.type).toBe('agent');
    expect(span.traceId).toBeDefined();
    expect(span.parentId).toBeUndefined();
    expect(span.toData().attributes['service.name']).toBe('test-service');
  });

  it('startSpan() with parent — child inherits traceId', () => {
    const parentSpan = tracer.startSpan('parent', 'agent');
    const childSpan = tracer.startSpan('child', 'tool', parentSpan);

    expect(childSpan.traceId).toBe(parentSpan.traceId);
    expect(childSpan.parentId).toBe(parentSpan.id);
    expect(parentSpan.toData().children).toHaveLength(1);
    expect(parentSpan.toData().children[0]?.id).toBe(childSpan.id);
  });

  it('trace() success — span status success, exports called', async () => {
    const result = await tracer.trace('my-op', 'agent', async (span) => {
      span.setAttribute('test', true);
      return 'done';
    });

    expect(result).toBe('done');
    expect(exporter.export).toHaveBeenCalledTimes(1);
    const exportedSpans = exporter.export.mock.calls[0]![0] as SpanData[];
    expect(exportedSpans).toHaveLength(1);
    expect(exportedSpans[0]?.status).toBe('success');
    expect(exportedSpans[0]?.attributes['test']).toBe(true);
    expect(exportedSpans[0]?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('trace() failure — span status failure, error rethrown, exports called', async () => {
    await expect(tracer.trace('failing-op', 'agent', async () => {
      throw new Error('Test error');
    })).rejects.toThrow('Test error');

    expect(exporter.export).toHaveBeenCalledTimes(1);
    const exportedSpans = exporter.export.mock.calls[0]![0] as SpanData[];
    expect(exportedSpans).toHaveLength(1);
    expect(exportedSpans[0]?.status).toBe('failure');
    expect(exportedSpans[0]?.error).toBe('Test error');
  });

  it('Span.setAttribute() — chainable, persisted', () => {
    const span = tracer.startSpan('op', 'agent');
    span.setAttribute('key1', 'val1').setAttribute('key2', 123);
    
    const data = span.toData();
    expect(data.attributes['key1']).toBe('val1');
    expect(data.attributes['key2']).toBe(123);
  });

  it('Span.setTokenUsage() — persisted in toData()', () => {
    const span = tracer.startSpan('op', 'model');
    span.setTokenUsage({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
    
    const data = span.toData();
    expect(data.tokenUsage).toEqual({ promptTokens: 10, completionTokens: 20, totalTokens: 30 });
  });

  it('Span.end() — sets completedAt, durationMs calculated', async () => {
    const span = tracer.startSpan('op', 'agent');
    await new Promise(resolve => setTimeout(resolve, 10));
    const data = span.end();
    
    expect(data.completedAt).toBeDefined();
    expect(data.durationMs).toBeGreaterThanOrEqual(10);
  });

  it('Span.addChild() — children in toData()', () => {
    const parent = tracer.startSpan('parent', 'agent');
    const child1 = tracer.startSpan('child1', 'tool');
    const child2 = tracer.startSpan('child2', 'tool');
    
    parent.addChild(child1);
    parent.addChild(child2);
    
    const data = parent.toData();
    expect(data.children).toHaveLength(2);
    expect(data.children[0]?.name).toBe('child1');
    expect(data.children[1]?.name).toBe('child2');
  });
});
