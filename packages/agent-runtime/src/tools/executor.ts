import type { ToolCall } from '@aurexara/ai-core';
import type { ToolRegistry } from './registry.js';
import type { AgentContext } from '../types.js';

export class ToolExecutor {
  constructor(private readonly registry: ToolRegistry) {}

  /**
   * Executes a tool call requested by the LLM.
   * Handles errors gracefully by returning them as a JSON string so the LLM can recover.
   * 
   * @param toolCall The tool call definition
   * @param context The current agent context
   * @returns A serialized string result or error message
   */
  public async execute(toolCall: ToolCall, context: AgentContext): Promise<string> {
    const tool = this.registry.get(toolCall.name);
    
    if (!tool) {
      return JSON.stringify({ error: `Tool '${toolCall.name}' is not registered.` });
    }

    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(toolCall.arguments);
    } catch (error) {
      return JSON.stringify({ error: `Failed to parse arguments for tool '${toolCall.name}'. Invalid JSON.` });
    }

    try {
      const result = await tool.handler(parsedArgs, context);
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ error: `Execution failed for tool '${toolCall.name}': ${errorMessage}` });
    }
  }
}
