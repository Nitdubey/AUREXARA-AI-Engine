import type { 
  WorkflowDefinition, 
  WorkflowNode, 
  WorkflowEdge, 
  WorkflowContext, 
  ApprovalConfig, 
  HandoffConfig, 
  RetryPolicy 
} from './types.js';
import type { Agent } from '../types.js';
import { randomUUID } from 'node:crypto';

/**
 * Result of a workflow validation.
 */
export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Validates and composes workflows.
 */
export class WorkflowComposer {
  /**
   * Validates a workflow definition for correctness.
   * Checks: no cycles, all edge targets/sources exist, all nodes reachable from root.
   * @param workflow The workflow definition to validate
   * @returns ValidationResult with isValid flag and any errors found
   */
  static validate(workflow: WorkflowDefinition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nodesMap = new Map<string, WorkflowNode>();

    for (const node of workflow.nodes) {
      if (nodesMap.has(node.id)) {
        errors.push(`Duplicate node ID found: ${node.id}`);
      }
      nodesMap.set(node.id, node);
    }

    if (workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
      return { isValid: errors.length === 0, errors, warnings };
    }

    // 1. Check all edge source/target nodes exist
    for (const edge of workflow.edges) {
      if (!nodesMap.has(edge.source)) {
        errors.push(`Edge source node not found: ${edge.source}`);
      }
      if (!nodesMap.has(edge.target)) {
        errors.push(`Edge target node not found: ${edge.target}`);
      }
    }

    // 2. Detect cycles using DFS/topological sort
    const adjacencyList = new Map<string, string[]>();
    for (const node of workflow.nodes) {
      adjacencyList.set(node.id, []);
    }
    for (const edge of workflow.edges) {
      if (adjacencyList.has(edge.source)) {
        adjacencyList.get(edge.source)!.push(edge.target);
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (detectCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          errors.push(`Cycle detected involving node: ${neighbor}`);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        detectCycle(node.id);
      }
    }

    // 3. Check all nodes are reachable from root nodes
    const inDegree = new Map<string, number>();
    for (const node of workflow.nodes) {
      inDegree.set(node.id, 0);
    }
    for (const edge of workflow.edges) {
      if (inDegree.has(edge.target)) {
        inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
      }
    }

    const rootNodes = workflow.nodes.filter(node => inDegree.get(node.id) === 0);
    if (rootNodes.length === 0 && workflow.nodes.length > 0) {
      errors.push('Workflow has no root nodes (nodes with no incoming edges)');
    }

    const reachable = new Set<string>();
    const dfsReachability = (nodeId: string) => {
      reachable.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          dfsReachability(neighbor);
        }
      }
    };

    for (const root of rootNodes) {
      dfsReachability(root.id);
    }

    for (const node of workflow.nodes) {
      if (!reachable.has(node.id)) {
        warnings.push(`Node is unreachable from root nodes: ${node.id}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Creates a workflow builder for fluent API construction.
   * @param id The workflow ID
   * @param name The workflow name
   * @returns A new WorkflowBuilder instance
   */
  static builder(id: string, name: string): WorkflowBuilder {
    return new WorkflowBuilder(id, name);
  }
}

/**
 * Fluent builder for workflow construction.
 */
export class WorkflowBuilder {
  private nodes: WorkflowNode[] = [];
  private edges: WorkflowEdge[] = [];
  private checkpointEnabled = false;

  /**
   * Creates a new WorkflowBuilder.
   * @param id The workflow ID
   * @param name The workflow name
   */
  constructor(private readonly id: string, private readonly name: string) {}

  /**
   * Adds a generic workflow node.
   * @param node The node to add
   * @returns The builder instance
   */
  addNode(node: WorkflowNode): this {
    this.nodes.push(node);
    return this;
  }

  /**
   * Adds an agent node.
   * @param id The node ID
   * @param agent The agent to execute
   * @param opts Additional options for the agent node
   * @returns The builder instance
   */
  addAgentNode(
    id: string,
    agent: Agent,
    opts?: { inputKey?: string; outputKey?: string; retryPolicy?: RetryPolicy }
  ): this {
    this.nodes.push({
      id,
      type: 'agent',
      agent,
      ...opts,
    } as unknown as WorkflowNode);
    return this;
  }

  /**
   * Adds a custom function node.
   * @param id The node ID
   * @param handler The custom handler function
   * @returns The builder instance
   */
  addCustomNode(id: string, handler: (ctx: WorkflowContext) => Promise<unknown>): this {
    this.nodes.push({
      id,
      type: 'custom',
      handler,
    } as unknown as WorkflowNode);
    return this;
  }

  /**
   * Adds an approval gate node.
   * @param id The node ID
   * @param config The approval configuration
   * @returns The builder instance
   */
  addApprovalNode(id: string, config: ApprovalConfig): this {
    this.nodes.push({
      id,
      type: 'approval',
      config,
    } as unknown as WorkflowNode);
    return this;
  }

  /**
   * Adds a handoff node.
   * @param id The node ID
   * @param config The handoff configuration
   * @returns The builder instance
   */
  addHandoffNode(id: string, config: HandoffConfig): this {
    this.nodes.push({
      id,
      type: 'handoff',
      config,
    } as unknown as WorkflowNode);
    return this;
  }

  /**
   * Connects two nodes with an optional condition.
   * @param source The source node ID
   * @param target The target node ID
   * @param condition Optional condition function
   * @returns The builder instance
   */
  connect(source: string, target: string, condition?: (ctx: WorkflowContext) => boolean): this {
    this.edges.push({
      id: randomUUID(),
      source,
      target,
      condition,
    } as unknown as WorkflowEdge);
    return this;
  }

  /**
   * Enables checkpointing for the workflow.
   * @returns The builder instance
   */
  enableCheckpoints(): this {
    this.checkpointEnabled = true;
    return this;
  }

  /**
   * Builds the workflow definition.
   * Validates the workflow and throws if invalid.
   * @returns The constructed WorkflowDefinition
   * @throws Error if the workflow is invalid
   */
  build(): WorkflowDefinition {
    const workflow: WorkflowDefinition = {
      id: this.id,
      name: this.name,
      nodes: this.nodes,
      edges: this.edges,
      checkpointEnabled: this.checkpointEnabled,
    };

    const validation = WorkflowComposer.validate(workflow);
    if (!validation.isValid) {
      throw new Error(`Workflow validation failed:\n- ${validation.errors.join('\n- ')}`);
    }

    return workflow;
  }
}
