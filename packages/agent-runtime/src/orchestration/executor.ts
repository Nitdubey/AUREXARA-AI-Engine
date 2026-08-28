import type {
  WorkflowDefinition,
  WorkflowContext,
  WorkflowResult,
  WorkflowNode,
  WorkflowState,
  NodeResult,
  RetryPolicy,
} from './types.js';
import type { CheckpointManager } from './checkpoint.js';
import { RetryExecutor } from './retry.js';
import type { HandoffManager } from './handoff.js';
import type { ApprovalManager } from './approval.js';
import type { AgentRunner } from '../runner.js';
import type { MemorySystem } from '../memory/interface.js';

/** Configuration for the workflow executor. */
export interface ExecutorConfig {
  readonly enableCheckpoints?: boolean;
  readonly defaultRetryPolicy?: RetryPolicy;
  readonly onNodeComplete?: (nodeId: string, result: NodeResult) => void;
  readonly onWorkflowStateChange?: (state: WorkflowState) => void;
}

/**
 * Enhanced workflow executor with checkpointing, retries, approval gates, and agent handoffs.
 */
export class WorkflowExecutor {
  private readonly retryExecutor: RetryExecutor;

  /**
   * Creates a WorkflowExecutor.
   * All parameters except agentRunner are optional for backward compatibility.
   */
  constructor(
    private readonly agentRunner: AgentRunner,
    private readonly config?: ExecutorConfig,
    private readonly checkpointManager?: CheckpointManager,
    private readonly approvalManager?: ApprovalManager,
    private readonly handoffManager?: HandoffManager
  ) {
    this.retryExecutor = new RetryExecutor();
  }

  /**
   * Execute a workflow from scratch.
   */
  public async execute(
    workflow: WorkflowDefinition,
    initialContext: WorkflowContext,
    memory: MemorySystem
  ): Promise<WorkflowResult> {
    const state: {
      workflowId: string;
      status: WorkflowState['status'];
      context: WorkflowContext;
      completedNodes: string[];
      failedNodes: string[];
      pendingApprovals: string[];
      nodeResults: NodeResult[];
      startedAt: Date;
      updatedAt: Date;
    } = {
      workflowId: workflow.id,
      status: 'running',
      context: { ...initialContext },
      completedNodes: [],
      failedNodes: [],
      pendingApprovals: [],
      nodeResults: [],
      startedAt: new Date(),
      updatedAt: new Date(),
    };

    const nodeMap = new Map<string, WorkflowNode>(workflow.nodes.map(n => [n.id, n]));

    // Find root nodes (nodes with no incoming edges)
    const targets = new Set(workflow.edges.map(e => e.target));
    let currentNodes = workflow.nodes.filter(n => !targets.has(n.id));

    if (currentNodes.length === 0) {
      return {
        workflowId: workflow.id,
        status: 'failed',
        finalContext: state.context,
        error: 'No starting nodes found in workflow (possible cycle)',
        nodeResults: [],
      };
    }

    try {
      while (currentNodes.length > 0) {
        // Execute current parallel wave
        const waveResults = await Promise.all(
          currentNodes.map(node => this.executeNode(node, state.context, memory))
        );

        // Process results
        for (let i = 0; i < currentNodes.length; i++) {
          const node = currentNodes[i]!;
          const result = waveResults[i]!;

          state.nodeResults.push(result);
          state.updatedAt = new Date();

          if (result.status === 'completed') {
            state.completedNodes.push(node.id);
            // Merge output into context if agent node with outputKey
            if (node.action.type === 'agent' && node.action.outputKey && result.output !== undefined) {
              state.context[node.action.outputKey] = result.output;
            }
          } else if (result.status === 'pending_approval') {
            state.pendingApprovals.push(node.id);
            state.status = 'paused';
          } else if (result.status === 'failed') {
            state.failedNodes.push(node.id);
            throw new Error(`Node '${node.id}' failed: ${result.error ?? 'unknown error'}`);
          }

          this.config?.onNodeComplete?.(node.id, result);
        }

        // Save checkpoint if enabled
        if ((workflow.checkpointEnabled || this.config?.enableCheckpoints) && this.checkpointManager) {
          await this.checkpointManager.createCheckpoint(state);
        }

        // If paused (approval pending), stop execution
        if (state.status === 'paused') {
          this.config?.onWorkflowStateChange?.(state);
          return {
            workflowId: workflow.id,
            status: 'paused',
            finalContext: state.context,
            nodeResults: state.nodeResults,
          };
        }

        // Find next nodes
        const nextNodes = new Set<WorkflowNode>();
        for (const edge of workflow.edges) {
          if (state.completedNodes.includes(edge.source) && !state.completedNodes.includes(edge.target)) {
            if (!edge.condition || edge.condition(state.context)) {
              const incomingEdges = workflow.edges.filter(e => e.target === edge.target);
              const allDepsMet = incomingEdges.every(e => state.completedNodes.includes(e.source));
              if (allDepsMet) {
                const targetNode = nodeMap.get(edge.target);
                if (targetNode) nextNodes.add(targetNode);
              }
            }
          }
        }

        currentNodes = Array.from(nextNodes);
      }

      state.status = 'completed';
      this.config?.onWorkflowStateChange?.(state);

      return {
        workflowId: workflow.id,
        status: 'completed',
        finalContext: state.context,
        nodeResults: state.nodeResults,
        duration: Date.now() - state.startedAt.getTime(),
      };
    } catch (error) {
      state.status = 'failed';
      this.config?.onWorkflowStateChange?.(state);

      return {
        workflowId: workflow.id,
        status: 'failed',
        finalContext: state.context,
        error: error instanceof Error ? error.message : String(error),
        nodeResults: state.nodeResults,
        duration: Date.now() - state.startedAt.getTime(),
      };
    }
  }

  /**
   * Resume a paused workflow from a checkpoint.
   */
  public async resume(
    checkpointId: string,
    workflow: WorkflowDefinition,
    memory: MemorySystem
  ): Promise<WorkflowResult> {
    if (!this.checkpointManager) {
      return {
        workflowId: workflow.id,
        status: 'failed',
        finalContext: {},
        error: 'No checkpoint manager configured',
        nodeResults: [],
      };
    }

    const restored = await this.checkpointManager.restoreFromCheckpoint(checkpointId);
    if (!restored) {
      return {
        workflowId: workflow.id,
        status: 'failed',
        finalContext: {},
        error: `Checkpoint ${checkpointId} not found`,
        nodeResults: [],
      };
    }

    // Resume from restored state — treat completed + pending_approval nodes as done
    const alreadyDone = new Set([...restored.completedNodes, ...restored.pendingApprovals]);
    const resumeContext = { ...restored.context };

    return this.execute(
      {
        ...workflow,
        nodes: workflow.nodes.filter(n => !alreadyDone.has(n.id)),
      },
      resumeContext,
      memory
    );
  }

  /**
   * Execute a single workflow node with optional retry support.
   */
  private async executeNode(
    node: WorkflowNode,
    context: WorkflowContext,
    memory: MemorySystem
  ): Promise<NodeResult> {
    const startTime = Date.now();
    const retryPolicy = node.retryPolicy ?? this.config?.defaultRetryPolicy;

    try {
      if (retryPolicy) {
        const retryResult = await this.retryExecutor.executeWithRetry(
          () => this.runNodeAction(node, context, memory),
          retryPolicy
        );

        if (retryResult.success) {
          return {
            nodeId: node.id,
            status: 'completed',
            output: retryResult.result,
            durationMs: Date.now() - startTime,
            retryCount: retryResult.attempts - 1,
          };
        } else {
          const lastError = retryResult.errors[retryResult.errors.length - 1];
          return {
            nodeId: node.id,
            status: 'failed',
            error: lastError?.message ?? 'Unknown error after retries',
            durationMs: Date.now() - startTime,
            retryCount: retryResult.attempts - 1,
          };
        }
      }

      // No retry policy — execute once
      const output = await this.runNodeAction(node, context, memory);
      return {
        nodeId: node.id,
        status: 'completed',
        output,
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    } catch (error) {
      return {
        nodeId: node.id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
        retryCount: 0,
      };
    }
  }

  /**
   * Run the action for a specific node type.
   */
  private async runNodeAction(
    node: WorkflowNode,
    context: WorkflowContext,
    memory: MemorySystem
  ): Promise<unknown> {
    switch (node.action.type) {
      case 'agent': {
        const input = node.action.inputKey ? context[node.action.inputKey] : context;
        const run = await this.agentRunner.run(node.action.agent, input, memory);
        if (run.status === 'failed') {
          throw new Error(`Agent '${node.action.agent.id}' failed: ${run.output}`);
        }
        return run.output;
      }
      case 'custom': {
        return await node.action.handler(context);
      }
      case 'approval': {
        if (!this.approvalManager) {
          throw new Error('Approval node requires an ApprovalManager');
        }
        const request = await this.approvalManager.requestApproval(
          context['__workflowId'] as string ?? 'unknown',
          node.id,
          node.action.approvalConfig,
          context
        );
        if (request.status === 'approved') {
          return { approved: true };
        } else if (request.status === 'rejected') {
          throw new Error(`Approval rejected for node '${node.id}'`);
        }
        // pending or timed_out
        return { approved: false, status: request.status };
      }
      case 'handoff': {
        if (!this.handoffManager) {
          throw new Error('Handoff node requires a HandoffManager');
        }
        const result = await this.handoffManager.executeHandoff(
          node.action.handoffConfig,
          context,
          memory
        );
        return result.output;
      }
      default:
        throw new Error(`Unknown node action type`);
    }
  }
}
