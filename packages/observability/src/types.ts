/** Status of a traced operation. */
export type SpanStatus = 'success' | 'failure' | 'timeout' | 'cancelled';

/** Token usage tracking. */
export interface TokenUsageData {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/** Span attributes — key-value pairs for metadata. */
export type SpanAttributes = Record<string, string | number | boolean | undefined>;

/** Serializable span data for export/storage. */
export interface SpanData {
  readonly id: string;
  readonly traceId: string;
  readonly parentId?: string;
  readonly name: string;
  readonly type: 'agent_run' | 'model_call' | 'tool_call' | 'retrieval' | 'memory' | 'embedding' | 'custom';
  readonly status: SpanStatus;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly attributes: SpanAttributes;
  readonly tokenUsage?: TokenUsageData;
  readonly cost?: number;
  readonly error?: string;
  readonly children: SpanData[];
}

/** Configuration for the Tracer. */
export interface TracerConfig {
  readonly serviceName: string;
  readonly environment: string;
  readonly exporters?: SpanExporter[];
}

/** Pluggable span exporter — for console, database, external services. */
export interface SpanExporter {
  readonly name: string;
  export(spans: SpanData[]): Promise<void>;
}

/** Log levels ordered by severity. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/** Structured log entry. */
export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly timestamp: Date;
  readonly service: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly data?: Record<string, unknown>;
  readonly error?: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

/** Logger configuration. */
export interface LoggerConfig {
  readonly service: string;
  readonly level: LogLevel;
  readonly pretty?: boolean;
}

/** Metric types. */
export type MetricType = 'counter' | 'histogram' | 'gauge';

/** A single metric data point. */
export interface MetricPoint {
  readonly name: string;
  readonly type: MetricType;
  readonly value: number;
  readonly labels: Record<string, string>;
  readonly timestamp: Date;
}

/** Metrics collector configuration. */
export interface MetricsConfig {
  readonly prefix: string;
  readonly flushIntervalMs?: number;
}
