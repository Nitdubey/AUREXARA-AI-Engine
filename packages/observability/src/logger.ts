import type { LoggerConfig, LogLevel, LogEntry } from './types.js';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * A structured logger for application events.
 */
export class StructuredLogger {
  private readonly config: LoggerConfig;
  private readonly baseContext: Record<string, unknown>;
  private readonly traceId?: string;
  private readonly spanId?: string;

  /**
   * Initializes a new StructuredLogger instance.
   * @param config - The logger configuration.
   * @param baseContext - Optional base context to attach to all logs.
   * @param traceId - Optional active trace ID.
   * @param spanId - Optional active span ID.
   */
  constructor(
    config: LoggerConfig,
    baseContext: Record<string, unknown> = {},
    traceId?: string,
    spanId?: string
  ) {
    this.config = config;
    this.baseContext = baseContext;
    this.traceId = traceId;
    this.spanId = spanId;
  }

  /**
   * Creates a child logger with additional context.
   * @param data - The extra context for the child logger.
   * @returns A new structured logger inheriting the current config and context.
   */
  public child(data: Record<string, unknown>): StructuredLogger {
    return new StructuredLogger(
      this.config,
      { ...this.baseContext, ...data },
      this.traceId,
      this.spanId
    );
  }

  /**
   * Creates a new logger bound to a specific trace and optionally a span.
   * @param traceId - The trace identifier.
   * @param spanId - The span identifier.
   * @returns A new structured logger bound to the trace.
   */
  public withTrace(traceId: string, spanId?: string): StructuredLogger {
    return new StructuredLogger(this.config, this.baseContext, traceId, spanId);
  }

  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.config.level];
  }

  private buildEntry(
    level: LogLevel,
    message: string,
    error?: Error,
    data?: Record<string, unknown>
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      service: this.config.service,
      ...(this.traceId && { traceId: this.traceId }),
      ...(this.spanId && { spanId: this.spanId }),
    };

    const combinedData = { ...this.baseContext, ...data };
    if (Object.keys(combinedData).length > 0) {
      // Create a mutable copy to assign to the readonly property
      (entry as any).data = combinedData;
    }

    if (error) {
      (entry as any).error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return entry;
  }

  private emit(entry: LogEntry): void {
    if (this.config.pretty) {
      const ts = entry.timestamp.toISOString();
      const prefix = `[${ts}] [${entry.service}] ${entry.level.toUpperCase()}:`;
      let metaStr = '';
      
      const metaKeys = [];
      if (entry.traceId) metaKeys.push(`trace=${entry.traceId}`);
      if (entry.spanId) metaKeys.push(`span=${entry.spanId}`);
      if (entry.data) metaKeys.push(`data=${JSON.stringify(entry.data)}`);
      
      if (metaKeys.length > 0) {
        metaStr = ` (${metaKeys.join(', ')})`;
      }

      const logMsg = `${prefix} ${entry.message}${metaStr}`;
      
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(logMsg);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
      } else if (entry.level === 'warn') {
        console.warn(logMsg);
      } else {
        console.log(logMsg);
      }
    } else {
      const output = JSON.stringify(entry);
      if (entry.level === 'error' || entry.level === 'fatal') {
        console.error(output);
      } else if (entry.level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  }

  /** Logs a debug message. */
  public debug(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('debug')) {
      this.emit(this.buildEntry('debug', message, undefined, data));
    }
  }

  /** Logs an info message. */
  public info(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('info')) {
      this.emit(this.buildEntry('info', message, undefined, data));
    }
  }

  /** Logs a warning message. */
  public warn(message: string, data?: Record<string, unknown>): void {
    if (this.shouldLog('warn')) {
      this.emit(this.buildEntry('warn', message, undefined, data));
    }
  }

  /** Logs an error message. */
  public error(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (this.shouldLog('error')) {
      this.emit(this.buildEntry('error', message, error, data));
    }
  }

  /** Logs a fatal message. */
  public fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    if (this.shouldLog('fatal')) {
      this.emit(this.buildEntry('fatal', message, error, data));
    }
  }
}
