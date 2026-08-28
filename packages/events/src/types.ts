/** Metadata common to all engine events. */
export interface EventMetadata {
  readonly timestamp: Date;
  readonly traceId?: string;
  readonly productId?: string;
  readonly userId?: string;
}

// ── Agent Events ──
export interface AgentStartedEvent {
  readonly type: 'agent.started';
  readonly data: {
    readonly runId: string;
    readonly agentId: string;
    readonly input: unknown;
  };
  readonly metadata: EventMetadata;
}

export interface AgentCompletedEvent {
  readonly type: 'agent.completed';
  readonly data: {
    readonly runId: string;
    readonly agentId: string;
    readonly output: unknown;
    readonly durationMs: number;
    readonly totalCost: number;
  };
  readonly metadata: EventMetadata;
}

export interface AgentFailedEvent {
  readonly type: 'agent.failed';
  readonly data: {
    readonly runId: string;
    readonly agentId: string;
    readonly error: string;
    readonly durationMs: number;
  };
  readonly metadata: EventMetadata;
}

// ── Model Events ──
export interface ModelCalledEvent {
  readonly type: 'model.called';
  readonly data: {
    readonly requestId: string;
    readonly provider: string;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly cost: number;
    readonly durationMs: number;
    readonly cached: boolean;
  };
  readonly metadata: EventMetadata;
}

export interface ModelStreamStartedEvent {
  readonly type: 'model.stream.started';
  readonly data: {
    readonly requestId: string;
    readonly provider: string;
    readonly model: string;
  };
  readonly metadata: EventMetadata;
}

export interface ModelStreamCompletedEvent {
  readonly type: 'model.stream.completed';
  readonly data: {
    readonly requestId: string;
    readonly provider: string;
    readonly model: string;
    readonly totalTokens: number;
    readonly cost: number;
    readonly durationMs: number;
  };
  readonly metadata: EventMetadata;
}

// ── Tool Events ──
export interface ToolCalledEvent {
  readonly type: 'tool.called';
  readonly data: {
    readonly toolId: string;
    readonly toolName: string;
    readonly input: unknown;
    readonly output: unknown;
    readonly durationMs: number;
    readonly status: 'success' | 'failure';
    readonly error?: string;
  };
  readonly metadata: EventMetadata;
}

// ── Retrieval Events ──
export interface RetrievalPerformedEvent {
  readonly type: 'retrieval.performed';
  readonly data: {
    readonly query: string;
    readonly resultCount: number;
    readonly durationMs: number;
    readonly scope: Record<string, unknown>;
  };
  readonly metadata: EventMetadata;
}

// ── Security Events ──
export interface SecurityViolationEvent {
  readonly type: 'security.violation';
  readonly data: {
    readonly violationType: 'prompt_injection' | 'unauthorized_access' | 'rate_limit' | 'data_leakage';
    readonly severity: 'low' | 'medium' | 'high' | 'critical';
    readonly details: string;
    readonly blocked: boolean;
  };
  readonly metadata: EventMetadata;
}

// ── Cost Events ──
export interface CostThresholdEvent {
  readonly type: 'cost.threshold';
  readonly data: {
    readonly scope: string;
    readonly currentSpend: number;
    readonly threshold: number;
    readonly period: 'daily' | 'monthly' | 'per_request';
  };
  readonly metadata: EventMetadata;
}

// ── Provider Health Events ──
export interface ProviderHealthEvent {
  readonly type: 'provider.health';
  readonly data: {
    readonly providerId: string;
    readonly status: 'healthy' | 'degraded' | 'down';
    readonly latencyMs?: number;
    readonly errorRate?: number;
  };
  readonly metadata: EventMetadata;
}

/** Discriminated union of all engine events. */
export type EngineEvent =
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | ModelCalledEvent
  | ModelStreamStartedEvent
  | ModelStreamCompletedEvent
  | ToolCalledEvent
  | RetrievalPerformedEvent
  | SecurityViolationEvent
  | CostThresholdEvent
  | ProviderHealthEvent;

/** Map from event type string to event interface. */
export type EngineEventMap = {
  [E in EngineEvent as E['type']]: E;
};

/** Extract event type strings. */
export type EngineEventType = EngineEvent['type'];

/** Handler for a specific event type. */
export type EventHandler<T extends EngineEventType = EngineEventType> =
  (event: EngineEventMap[T]) => void | Promise<void>;

/** Wildcard handler that receives any event. */
export type WildcardEventHandler = (event: EngineEvent) => void | Promise<void>;

/** Unsubscribe function returned by subscribe. */
export type Unsubscribe = () => void;
