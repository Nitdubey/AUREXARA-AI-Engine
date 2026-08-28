// Agent streaming event types and manager

/** Events emitted during agent streaming */
export type StreamEventType = 
  | 'stream_start'
  | 'token'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'step_complete'
  | 'stream_end'
  | 'error';

/** Base stream event */
export interface StreamEvent {
  readonly type: StreamEventType;
  readonly timestamp: Date;
  readonly agentId: string;
  readonly runId: string;
}

/** Token event — a single token in the response */
export interface TokenEvent extends StreamEvent {
  readonly type: 'token';
  readonly token: string;
  readonly accumulated: string;
}

/** Tool call start event */
export interface ToolCallStartEvent extends StreamEvent {
  readonly type: 'tool_call_start';
  readonly toolName: string;
  readonly args: unknown;
}

/** Tool call end event */
export interface ToolCallEndEvent extends StreamEvent {
  readonly type: 'tool_call_end';
  readonly toolName: string;
  readonly result: unknown;
  readonly durationMs: number;
}

/** Error event */
export interface ErrorEvent extends StreamEvent {
  readonly type: 'error';
  readonly error: string;
}

/** Union of all possible stream events */
export type AgentStreamEvent = StreamEvent | TokenEvent | ToolCallStartEvent | ToolCallEndEvent | ErrorEvent;

/** Callback for stream events */
export type StreamCallback = (event: AgentStreamEvent) => void;

/**
 * Manages agent response streaming.
 * Buffers events and dispatches to registered listeners.
 */
export class AgentStreamManager {
  private readonly listeners = new Map<string, StreamCallback[]>(); // runId -> callbacks
  private readonly buffers = new Map<string, AgentStreamEvent[]>(); // runId -> events

  /**
   * Register a listener for a specific run.
   * @param runId The ID of the agent run.
   * @param callback The callback to invoke when an event is emitted.
   * @returns An unsubscribe function.
   */
  public subscribe(runId: string, callback: StreamCallback): () => void {
    const currentListeners = this.listeners.get(runId) ?? [];
    this.listeners.set(runId, [...currentListeners, callback]);

    return () => {
      const activeListeners = this.listeners.get(runId) ?? [];
      this.listeners.set(
        runId,
        activeListeners.filter((cb) => cb !== callback)
      );
    };
  }

  /**
   * Emit an event for a specific run.
   * Buffers the event and dispatches to all listeners.
   * @param event The event to emit.
   */
  public emit(event: AgentStreamEvent): void {
    const { runId } = event;

    const currentBuffer = this.buffers.get(runId) ?? [];
    this.buffers.set(runId, [...currentBuffer, event]);

    const runListeners = this.listeners.get(runId) ?? [];
    for (const listener of runListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error(`Error in stream listener for run ${runId}:`, error);
      }
    }
  }

  /**
   * Get all buffered events for a run.
   * @param runId The ID of the agent run.
   * @returns A readonly array of buffered events.
   */
  public getBuffer(runId: string): readonly AgentStreamEvent[] {
    return this.buffers.get(runId) ?? [];
  }

  /**
   * Clear buffer for a run.
   * @param runId The ID of the agent run.
   */
  public clearBuffer(runId: string): void {
    this.buffers.delete(runId);
  }

  /**
   * Helper: create a stream start event.
   * @param agentId The ID of the agent.
   * @param runId The ID of the agent run.
   * @returns A stream start event.
   */
  public createStartEvent(agentId: string, runId: string): StreamEvent {
    return {
      type: 'stream_start',
      timestamp: new Date(),
      agentId,
      runId,
    };
  }

  /**
   * Helper: create a token event.
   * @param agentId The ID of the agent.
   * @param runId The ID of the agent run.
   * @param token The token string.
   * @param accumulated The accumulated response string.
   * @returns A token event.
   */
  public createTokenEvent(agentId: string, runId: string, token: string, accumulated: string): TokenEvent {
    return {
      type: 'token',
      timestamp: new Date(),
      agentId,
      runId,
      token,
      accumulated,
    };
  }

  /**
   * Helper: create an end event.
   * @param agentId The ID of the agent.
   * @param runId The ID of the agent run.
   * @returns A stream end event.
   */
  public createEndEvent(agentId: string, runId: string): StreamEvent {
    return {
      type: 'stream_end',
      timestamp: new Date(),
      agentId,
      runId,
    };
  }
}
