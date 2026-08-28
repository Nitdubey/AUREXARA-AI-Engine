import { randomUUID } from 'node:crypto';
import { Span } from './span.js';
import type { SpanData, SpanExporter, TracerConfig } from './types.js';

/**
 * A span exporter that pretty-prints spans to the console.
 */
export class ConsoleExporter implements SpanExporter {
  public readonly name = 'ConsoleExporter';

  /**
   * Exports spans to the console.
   * @param spans - The spans to export.
   */
  public async export(spans: SpanData[]): Promise<void> {
    for (const span of spans) {
      this.printSpan(span, 0);
    }
  }

  private printSpan(span: SpanData, depth: number): void {
    const indent = '  '.repeat(depth);
    const duration = span.durationMs !== undefined ? `${span.durationMs}ms` : 'UNFINISHED';
    const statusMark = span.status === 'success' ? '✅' : span.status === 'failure' ? '❌' : '⚠️';
    
    console.log(`${indent}${statusMark} [${span.type}] ${span.name} (${duration})`);
    
    if (span.error) {
      console.error(`${indent}  Error: ${span.error}`);
    }
    
    if (span.cost !== undefined) {
      console.log(`${indent}  Cost: $${span.cost}`);
    }
    
    for (const child of span.children) {
      this.printSpan(child, depth + 1);
    }
  }
}

/**
 * Tracing manager responsible for creating and tracking spans.
 */
export class Tracer {
  private readonly config: TracerConfig;
  private readonly exporters: SpanExporter[];

  /**
   * Initializes a new Tracer instance.
   * @param config - The tracer configuration.
   */
  constructor(config: TracerConfig) {
    this.config = config;
    this.exporters = config.exporters ?? [new ConsoleExporter()];
  }

  /**
   * Generates a new unique trace ID.
   * @returns A new trace ID string.
   */
  public createTraceId(): string {
    return randomUUID();
  }

  /**
   * Starts a new span.
   * @param name - The name of the operation.
   * @param type - The category of the span.
   * @param parentSpan - An optional parent span to nest under.
   * @returns The newly created span.
   */
  public startSpan(name: string, type: SpanData['type'], parentSpan?: Span): Span {
    const traceId = parentSpan ? parentSpan.traceId : this.createTraceId();
    const span = new Span(traceId, name, type, parentSpan?.id);
    span.setAttribute('service.name', this.config.serviceName);
    span.setAttribute('service.environment', this.config.environment);
    
    if (parentSpan) {
      parentSpan.addChild(span);
    }
    
    return span;
  }

  /**
   * Executes a function within a traced span, automatically managing completion and export.
   * @param name - The name of the operation.
   * @param type - The category of the span.
   * @param fn - The function to execute.
   * @returns The result of the function.
   */
  public async trace<T>(
    name: string,
    type: SpanData['type'],
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, type);
    try {
      const result = await fn(span);
      span.setStatus('success');
      const data = span.end();
      await this.exportSpans([data]);
      return result;
    } catch (error) {
      span.setError(error instanceof Error ? error : String(error));
      const data = span.end();
      await this.exportSpans([data]);
      throw error;
    }
  }

  /**
   * Exports an array of span data to all configured exporters.
   * @param spans - The spans to export.
   */
  public async exportSpans(spans: SpanData[]): Promise<void> {
    const exportPromises = this.exporters.map(exporter => 
      exporter.export(spans).catch(err => {
        console.error(`Exporter ${exporter.name} failed:`, err);
      })
    );
    await Promise.all(exportPromises);
  }
}
