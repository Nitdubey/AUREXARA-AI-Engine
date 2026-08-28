import type { Message, ToolDefinition } from '@aurexara/ai-core';
import type { Agent, AgentContext } from './types.js';
import type { MemorySystem } from './memory/interface.js';

export class ContextEngine {
  /**
   * Assembles the initial context for an agent run.
   */
  public assemble(
    agent: Agent,
    input: unknown,
    memory: MemorySystem,
    availableTools: readonly ToolDefinition[]
  ): AgentContext {
    // Basic context assembly for MVP:
    // 1. System Prompt
    // 2. Stringified Input

    const messages: Message[] = [
      {
        role: 'system',
        content: agent.systemPrompt,
      },
      {
        role: 'user',
        content: typeof input === 'string' ? input : JSON.stringify(input, null, 2),
      },
    ];

    return {
      messages,
      availableTools,
      memory,
    };
  }

  /**
   * Appends a new message to the context, adhering to token budgets (simplified for MVP).
   */
  public update(context: AgentContext, newMessage: Message): AgentContext {
    return {
      ...context,
      messages: [...context.messages, newMessage],
    };
  }
}
