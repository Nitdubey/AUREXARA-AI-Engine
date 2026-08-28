import type { AgentContext } from '../types.js';
import type { ToolHandler } from '../tools/registry.js';

/** A single step in a tool chain */
export interface ToolChainStep {
  readonly name: string;
  readonly toolName: string;
  readonly transformInput?: (previousOutput: unknown, context: AgentContext) => unknown;
  readonly condition?: (previousOutput: unknown, context: AgentContext) => boolean;
}

/** Result of a tool chain execution */
export interface ToolChainResult {
  readonly success: boolean;
  readonly steps: readonly ToolChainStepResult[];
  readonly finalOutput: unknown;
  readonly durationMs: number;
}

export interface ToolChainStepResult {
  readonly stepName: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly durationMs: number;
  readonly skipped: boolean;
}

/** Tool chain definition */
export interface ToolChainDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly steps: readonly ToolChainStep[];
}

/**
 * Executes chains of tools in sequence.
 * Output of one tool feeds into the next.
 */
export class ToolChainExecutor {
  private readonly handlers = new Map<string, ToolHandler>();

  /** Register a tool handler for use in chains */
  registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  /**
   * Execute a tool chain.
   * @param chain The chain definition
   * @param initialInput The initial input to the first tool
   * @param context The agent context
   */
  async execute(
    chain: ToolChainDefinition,
    initialInput: unknown,
    context: AgentContext
  ): Promise<ToolChainResult> {
    const startTime = Date.now();
    const steps: ToolChainStepResult[] = [];
    let currentInput = initialInput;

    for (const step of chain.steps) {
      const stepStartTime = Date.now();

      try {
        if (step.condition && !step.condition(currentInput, context)) {
          steps.push({
            stepName: step.name,
            toolName: step.toolName,
            input: currentInput,
            output: null,
            durationMs: Date.now() - stepStartTime,
            skipped: true,
          });
          continue;
        }

        const input = step.transformInput ? step.transformInput(currentInput, context) : currentInput;
        const handler = this.handlers.get(step.toolName);

        if (!handler) {
          throw new Error(`Tool handler not found: ${step.toolName}`);
        }

        const output = await handler(input, context);

        steps.push({
          stepName: step.name,
          toolName: step.toolName,
          input,
          output,
          durationMs: Date.now() - stepStartTime,
          skipped: false,
        });

        currentInput = output;
      } catch (error) {
        return {
          success: false,
          steps,
          finalOutput: currentInput,
          durationMs: Date.now() - startTime,
        };
      }
    }

    return {
      success: true,
      steps,
      finalOutput: currentInput,
      durationMs: Date.now() - startTime,
    };
  }
}
