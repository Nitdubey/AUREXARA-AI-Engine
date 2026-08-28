import type { ToolDefinition } from '@aurexara/ai-core';
import type { AgentContext } from '../types.js';

export type ToolHandler<T = unknown, R = unknown> = (args: T, context: AgentContext) => Promise<R>;

export interface RegisteredTool<T = unknown, R = unknown> {
  readonly definition: ToolDefinition;
  readonly handler: ToolHandler<T, R>;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  public register<T = unknown, R = unknown>(definition: ToolDefinition, handler: ToolHandler<T, R>): void {
    if (this.tools.has(definition.name)) {
      throw new Error(`Tool ${definition.name} is already registered.`);
    }
    this.tools.set(definition.name, { definition, handler: handler as ToolHandler<unknown, unknown> });
  }

  public get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  public discover(_context: AgentContext): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }
}
