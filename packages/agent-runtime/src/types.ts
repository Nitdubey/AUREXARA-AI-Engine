import type { Message, ToolDefinition } from '@aurexara/ai-core';
import type { MemorySystem } from './memory/interface.js';

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly systemPrompt: string;
  readonly tools: readonly string[]; // Tool IDs
  readonly model: string;
  readonly maxSteps: number;
}

export interface AgentContext {
  readonly messages: readonly Message[];
  readonly availableTools: readonly ToolDefinition[];
  readonly memory: MemorySystem;
}

export interface AgentStep {
  readonly id: string;
  readonly type: 'tool_call' | 'llm_call' | 'reasoning';
  readonly input: unknown;
  readonly output: unknown;
  readonly durationMs: number;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly error?: string;
}

export interface AgentRun {
  readonly id: string;
  readonly agentId: string;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly input: unknown;
  readonly output?: unknown;
  readonly steps: readonly AgentStep[];
  readonly context: AgentContext;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
}
