import type { Agent } from '../types.js';

/** Agent configuration that can be modified at runtime */
export interface AgentConfig {
  readonly model?: string;
  readonly maxSteps?: number;
  readonly temperature?: number;
  readonly timeoutMs?: number;
  readonly tags?: readonly string[];
}

/** Agent lifecycle state */
export type AgentState = 'created' | 'ready' | 'running' | 'paused' | 'stopped' | 'error';

/** Managed agent with lifecycle */
export interface ManagedAgent {
  readonly agent: Agent;
  readonly state: AgentState;
  readonly config: AgentConfig;
  readonly createdAt: Date;
  readonly lastActiveAt?: Date;
  readonly runCount: number;
  readonly errorCount: number;
}

/**
 * Manages agent lifecycle — creation, configuration, state tracking.
 */
export class AgentLifecycleManager {
  private readonly agents = new Map<string, ManagedAgent>();

  /**
   * Register an agent for lifecycle management.
   */
  register(agent: Agent, config?: AgentConfig): ManagedAgent {
    const managed: ManagedAgent = {
      agent,
      state: 'created',
      config: config ?? {},
      createdAt: new Date(),
      runCount: 0,
      errorCount: 0,
    };
    this.agents.set(agent.id, managed);
    return managed;
  }

  /**
   * Get a managed agent by ID.
   */
  get(agentId: string): ManagedAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Update agent configuration.
   */
  updateConfig(agentId: string, config: Partial<AgentConfig>): ManagedAgent | undefined {
    const managed = this.agents.get(agentId);
    if (!managed) return undefined;

    const updated: ManagedAgent = {
      ...managed,
      config: { ...managed.config, ...config },
    };
    this.agents.set(agentId, updated);
    return updated;
  }

  /**
   * Update agent state.
   */
  updateState(agentId: string, state: AgentState): void {
    const managed = this.agents.get(agentId);
    if (managed) {
      this.agents.set(agentId, { ...managed, state, lastActiveAt: new Date() });
    }
  }

  /**
   * Record that an agent completed a run.
   */
  recordRun(agentId: string, success: boolean): void {
    const managed = this.agents.get(agentId);
    if (managed) {
      this.agents.set(agentId, {
        ...managed,
        runCount: managed.runCount + 1,
        errorCount: success ? managed.errorCount : managed.errorCount + 1,
        lastActiveAt: new Date(),
      });
    }
  }

  /**
   * List all managed agents.
   */
  listAll(): readonly ManagedAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * List agents by state.
   */
  listByState(state: AgentState): readonly ManagedAgent[] {
    return this.listAll().filter(a => a.state === state);
  }

  /**
   * Deregister (remove) an agent.
   */
  deregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get agent health metrics.
   */
  getHealthMetrics(agentId: string): { successRate: number; totalRuns: number; errorRate: number } | undefined {
    const managed = this.agents.get(agentId);
    if (!managed) return undefined;

    const total = managed.runCount;
    if (total === 0) return { successRate: 1, totalRuns: 0, errorRate: 0 };

    const errors = managed.errorCount;
    const successRate = (total - errors) / total;
    const errorRate = errors / total;

    return { successRate, totalRuns: total, errorRate };
  }
}
