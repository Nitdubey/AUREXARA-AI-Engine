import type { AgentRunner } from '../runner.js';
import type { MemorySystem } from '../memory/interface.js';
import type { HandoffConfig, HandoffResult, WorkflowContext } from './types.js';

/**
 * Manages handoff operations between agents within a workflow.
 */
export class HandoffManager {
  /**
   * Creates a new HandoffManager.
   * @param agentRunner The agent runner to execute target agents.
   */
  constructor(private readonly agentRunner: AgentRunner) {}

  /**
   * Executes an agent handoff — transfers control from current workflow node to a target agent.
   * @param config The handoff configuration (targetAgent, type, contextKeys, inputKey, outputKey).
   * @param context The current workflow context.
   * @param memory The memory system.
   * @param sourceNodeId The ID of the node initiating the handoff.
   * @returns HandoffResult with the output from the target agent.
   */
  async executeHandoff(
    config: HandoffConfig,
    context: WorkflowContext,
    memory: MemorySystem,
    sourceNodeId = 'unknown'
  ): Promise<HandoffResult> {
    const startTime = Date.now();
    const handoffContext = this.buildHandoffContext(config, context);

    const runResult = await this.agentRunner.run(config.targetAgent, handoffContext, memory);

    if (runResult.status === 'failed') {
      throw new Error(`Handoff to agent '${config.targetAgent.id}' failed: ${runResult.output}`);
    }

    return {
      sourceNodeId,
      targetAgentId: config.targetAgent.id,
      type: config.type,
      output: runResult.output,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Builds the handoff context — creates a filtered context for the target agent.
   * @param config The handoff configuration.
   * @param context The current workflow context.
   * @returns The filtered context for the target agent.
   */
  private buildHandoffContext(config: HandoffConfig, context: WorkflowContext): unknown {
    if (config.contextKeys && config.contextKeys.length > 0) {
      const filteredContext: Record<string, unknown> = {};
      for (const key of config.contextKeys) {
        if (key in context) {
          filteredContext[key] = context[key];
        }
      }
      return filteredContext;
    }

    if (config.inputKey) {
      return context[config.inputKey];
    }

    return context;
  }
}
