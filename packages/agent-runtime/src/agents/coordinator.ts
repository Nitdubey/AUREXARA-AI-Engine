import { randomUUID } from 'node:crypto';
import type { Agent, AgentRun } from '../types.js';
import type { AgentRunner } from '../runner.js';
import type { MemorySystem } from '../memory/interface.js';

/** Agent team role */
export type TeamRole = 'supervisor' | 'worker' | 'reviewer' | 'specialist';

/** Agent with team role assignment */
export interface TeamMember {
  readonly agent: Agent;
  readonly role: TeamRole;
  readonly capabilities: readonly string[];
}

/** Task to distribute to agents */
export interface AgentTask {
  readonly id: string;
  readonly description: string;
  readonly assignedTo?: string; // Agent ID
  readonly priority: 'low' | 'medium' | 'high' | 'critical';
  readonly dependencies: readonly string[]; // Task IDs that must complete first
  readonly status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  readonly result?: unknown;
}

/** Result of a multi-agent coordination run */
export interface CoordinationResult {
  readonly teamId: string;
  readonly tasks: readonly AgentTask[];
  readonly agentRuns: readonly AgentRun[];
  readonly status: 'completed' | 'partial' | 'failed';
  readonly finalOutput: unknown;
  readonly durationMs: number;
}

/**
 * Coordinates a team of agents using supervisor pattern.
 * The supervisor decomposes work, assigns to workers, and aggregates results.
 */
export class AgentCoordinator {
  /**
   * Initialize coordinator with an agent runner
   * @param agentRunner Configured agent runner for executing individual tasks
   */
  constructor(private readonly agentRunner: AgentRunner) {}

  /**
   * Run a coordinated multi-agent task.
   * @param team The team members with roles
   * @param objective The objective to accomplish
   * @param memory The shared memory system
   * @returns The coordination result containing tasks and runs
   */
  public async coordinate(
    team: readonly TeamMember[],
    objective: string,
    memory: MemorySystem
  ): Promise<CoordinationResult> {
    const startTime = Date.now();
    const teamId = randomUUID();

    let supervisor = team.find(member => member.role === 'supervisor');
    if (!supervisor && team.length > 0) {
      supervisor = team[0];
    }

    if (!supervisor) {
      return {
        teamId,
        tasks: [],
        agentRuns: [],
        status: 'failed',
        finalOutput: new Error('No team members available for coordination.'),
        durationMs: Date.now() - startTime
      };
    }

    // Decompose into tasks (simplistic for now)
    const workers = team.filter(member => member !== supervisor && member.role === 'worker');
    const initialTasks: AgentTask[] = workers.map(worker => ({
      id: randomUUID(),
      description: `Task for ${worker.agent.name} to achieve: ${objective}`,
      assignedTo: worker.agent.id,
      priority: 'medium',
      dependencies: [],
      status: 'pending'
    }));

    // Execute tasks respecting dependencies
    const { tasks: executedTasks, runs: agentRuns } = await this.executeTasks(initialTasks, team, memory);

    // Aggregate results
    const results = executedTasks.map(t => t.result);
    
    // Reviewer phase (optional)
    const reviewer = team.find(member => member.role === 'reviewer');
    let finalOutput: unknown = results;

    if (reviewer) {
      const reviewInput = { objective, results };
      const reviewerRun = await this.agentRunner.run(reviewer.agent, reviewInput, memory);
      finalOutput = reviewerRun.output;
      agentRuns.push(reviewerRun);
    }

    const allCompleted = executedTasks.every(t => t.status === 'completed');

    return {
      teamId,
      tasks: executedTasks,
      agentRuns,
      status: allCompleted ? 'completed' : 'partial',
      finalOutput,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Execute tasks in dependency order.
   * Tasks with no dependencies run in parallel.
   * @param tasks The tasks to execute
   * @param team The team of available agents
   * @param memory Shared memory
   * @returns Finished tasks and agent runs
   */
  private async executeTasks(
    tasks: AgentTask[],
    team: readonly TeamMember[],
    memory: MemorySystem
  ): Promise<{ tasks: AgentTask[]; runs: AgentRun[] }> {
    const runs: AgentRun[] = [];
    const updatedTasks: AgentTask[] = [];
    const pendingTasks = [...tasks];
    const completedTasks = new Set<string>();

    while (pendingTasks.length > 0) {
      const runnableTasks = pendingTasks.filter(task =>
        task.dependencies.every(dep => completedTasks.has(dep))
      );

      if (runnableTasks.length === 0) {
        break; // Deadlock or unresolvable dependencies
      }

      const batchResults = await Promise.all(
        runnableTasks.map(async (task) => {
          let assignee = task.assignedTo ? team.find(m => m.agent.id === task.assignedTo) : undefined;
          if (!assignee) {
            assignee = this.findBestAgent(task, team);
          }

          if (!assignee) {
            return { ...task, status: 'failed' as const, result: 'No agent available' };
          }

          try {
            const run = await this.agentRunner.run(assignee.agent, task.description, memory);
            runs.push(run);
            
            return {
              ...task,
              status: run.status === 'completed' ? 'completed' as const : 'failed' as const,
              assignedTo: assignee.agent.id,
              result: run.output ?? run.status
            };
          } catch (error) {
            return {
              ...task,
              status: 'failed' as const,
              assignedTo: assignee.agent.id,
              result: error instanceof Error ? error.message : String(error)
            };
          }
        })
      );

      for (const processed of batchResults) {
        updatedTasks.push(processed);
        if (processed.status === 'completed') {
          completedTasks.add(processed.id);
        }
        
        const idx = pendingTasks.findIndex(t => t.id === processed.id);
        if (idx !== -1) {
          pendingTasks.splice(idx, 1);
        }
      }
    }

    for (const remaining of pendingTasks) {
      updatedTasks.push({ ...remaining, status: 'failed' as const, result: 'Dependency failure' });
    }

    return { tasks: updatedTasks, runs };
  }

  /**
   * Find the best agent for a task based on capabilities.
   * @param task Task to be assigned
   * @param team Team of agents
   * @returns The best matching team member
   */
  private findBestAgent(
    _task: AgentTask,
    team: readonly TeamMember[]
  ): TeamMember | undefined {
    return team.find(member => member.role === 'worker');
  }
}
