import type { Agent } from '../types.js';

// ─── Existing types (keep ALL of these) ───
export interface WorkflowContext { [key: string]: unknown; }

export type NodeAction = 
  | { type: 'agent'; agent: Agent; inputKey?: string; outputKey?: string }
  | { type: 'custom'; handler: (context: WorkflowContext) => Promise<unknown> }
  | { type: 'approval'; approvalConfig: ApprovalConfig }
  | { type: 'handoff'; handoffConfig: HandoffConfig };

export interface WorkflowNode {
  readonly id: string;
  readonly name?: string;
  readonly action: NodeAction;
  readonly retryPolicy?: RetryPolicy;
}

export interface WorkflowEdge {
  readonly source: string;
  readonly target: string;
  readonly condition?: (context: WorkflowContext) => boolean;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly name: string;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
  readonly checkpointEnabled?: boolean;
}

export interface WorkflowResult {
  readonly workflowId: string;
  readonly status: 'completed' | 'failed' | 'paused' | 'cancelled';
  readonly finalContext: WorkflowContext;
  readonly error?: string;
  readonly nodeResults: readonly NodeResult[];
  readonly duration?: number;
}

// ─── NEW: Node execution result ───
export interface NodeResult {
  readonly nodeId: string;
  readonly status: 'completed' | 'failed' | 'skipped' | 'pending_approval';
  readonly output?: unknown;
  readonly error?: string;
  readonly durationMs: number;
  readonly retryCount: number;
}

// ─── NEW: Workflow state machine ───
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowState {
  readonly workflowId: string;
  readonly status: WorkflowStatus;
  readonly context: WorkflowContext;
  readonly completedNodes: readonly string[];
  readonly failedNodes: readonly string[];
  readonly pendingApprovals: readonly string[];
  readonly nodeResults: readonly NodeResult[];
  readonly startedAt: Date;
  readonly updatedAt: Date;
  readonly checkpointId?: string;
}

// ─── NEW: Retry policy ───
export type RetryStrategy = 'fixed' | 'exponential' | 'linear';

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly strategy: RetryStrategy;
  readonly baseDelayMs: number;
  readonly maxDelayMs?: number;
  readonly retryableErrors?: readonly string[];
}

// ─── NEW: Checkpoint ───
export interface Checkpoint {
  readonly id: string;
  readonly workflowId: string;
  readonly state: WorkflowState;
  readonly createdAt: Date;
}

// ─── NEW: Approval gate ───
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'timed_out';

export interface ApprovalConfig {
  readonly approverRole: string;
  readonly message: string;
  readonly timeoutMs?: number;
  readonly autoApproveOnTimeout?: boolean;
}

export interface ApprovalRequest {
  readonly id: string;
  readonly workflowId: string;
  readonly nodeId: string;
  readonly config: ApprovalConfig;
  readonly status: ApprovalStatus;
  readonly context: WorkflowContext;
  readonly createdAt: Date;
  readonly resolvedAt?: Date;
  readonly resolvedBy?: string;
}

// ─── NEW: Agent handoff ───
export type HandoffType = 'delegate' | 'escalate' | 'collaborate';

export interface HandoffConfig {
  readonly targetAgent: Agent;
  readonly type: HandoffType;
  readonly contextKeys?: readonly string[];
  readonly inputKey?: string;
  readonly outputKey?: string;
}

export interface HandoffResult {
  readonly sourceNodeId: string;
  readonly targetAgentId: string;
  readonly type: HandoffType;
  readonly output: unknown;
  readonly durationMs: number;
}
