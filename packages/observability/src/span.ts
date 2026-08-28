import { randomUUID } from 'node:crypto';
import type { SpanAttributes, SpanData, SpanStatus, TokenUsageData } from './types.js';

/**
 * Represents a single timed and tracked operation in the system.
 */
export class Span {
  public readonly id: string;
  public readonly traceId: string;
  public readonly parentId?: string;
  public readonly name: string;
  public readonly type: SpanData['type'];

  private readonly _startedAt: Date;
  private _status: SpanStatus;
  private _completedAt?: Date;
  private _attributes: SpanAttributes;
  private _tokenUsage?: TokenUsageData;
  private _cost?: number;
  private _error?: string;
  private readonly _children: Span[];

  /**
   * Initializes a new Span instance.
   * @param traceId - The global trace identifier this span belongs to.
   * @param name - The operation name.
   * @param type - The category/type of the span.
   * @param parentId - The optional parent span ID.
   * @param id - The optional span ID (generates a UUID if not provided).
   */
  constructor(
    traceId: string,
    name: string,
    type: SpanData['type'],
    parentId?: string,
    id?: string
  ) {
    this.id = id ?? randomUUID();
    this.traceId = traceId;
    this.name = name;
    this.type = type;
    this.parentId = parentId;
    this._startedAt = new Date();
    this._status = 'success';
    this._attributes = {};
    this._children = [];
  }

  /** Gets whether this span has been ended. */
  public get isEnded(): boolean {
    return this._completedAt !== undefined;
  }

  /** Gets the elapsed time in milliseconds. */
  public get elapsed(): number {
    const end = this._completedAt ?? new Date();
    return end.getTime() - this._startedAt.getTime();
  }

  /**
   * Sets a single attribute on the span.
   * @param key - The attribute key.
   * @param value - The attribute value.
   * @returns This instance for chaining.
   */
  public setAttribute(key: string, value: string | number | boolean): this {
    this._attributes[key] = value;
    return this;
  }

  /**
   * Sets multiple attributes on the span.
   * @param attrs - The attributes to set.
   * @returns This instance for chaining.
   */
  public setAttributes(attrs: SpanAttributes): this {
    this._attributes = { ...this._attributes, ...attrs };
    return this;
  }

  /**
   * Sets token usage information.
   * @param usage - The token usage data.
   * @returns This instance for chaining.
   */
  public setTokenUsage(usage: TokenUsageData): this {
    this._tokenUsage = { ...usage };
    return this;
  }

  /**
   * Sets the monetary cost of the operation.
   * @param cost - The cost value.
   * @returns This instance for chaining.
   */
  public setCost(cost: number): this {
    this._cost = cost;
    return this;
  }

  /**
   * Updates the status of the span.
   * @param status - The new status.
   * @returns This instance for chaining.
   */
  public setStatus(status: SpanStatus): this {
    this._status = status;
    return this;
  }

  /**
   * Marks the span as failed and records the error.
   * @param error - The error object or message.
   * @returns This instance for chaining.
   */
  public setError(error: Error | string): this {
    this._status = 'failure';
    this._error = error instanceof Error ? error.message : error;
    if (error instanceof Error && error.stack) {
      this.setAttribute('error.stack', error.stack);
    }
    return this;
  }

  /**
   * Adds a child span to this span.
   * @param span - The child span.
   */
  public addChild(span: Span): void {
    this._children.push(span);
  }

  /**
   * Completes the span, marking its end time and calculating its duration.
   * @returns The serialized span data.
   */
  public end(): SpanData {
    if (!this.isEnded) {
      this._completedAt = new Date();
    }
    return this.toData();
  }

  /**
   * Serializes the span to a plain data object.
   * @returns The span data.
   */
  public toData(): SpanData {
    return {
      id: this.id,
      traceId: this.traceId,
      parentId: this.parentId,
      name: this.name,
      type: this.type,
      status: this._status,
      startedAt: this._startedAt,
      completedAt: this._completedAt,
      durationMs: this.isEnded ? this.elapsed : undefined,
      attributes: { ...this._attributes },
      tokenUsage: this._tokenUsage,
      cost: this._cost,
      error: this._error,
      children: this._children.map((child) => child.toData()),
    };
  }
}
