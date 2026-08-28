import type { ModelGateway, Message } from '@aurexara/ai-core';
import type { Agent, AgentRun, AgentStep, AgentContext } from './types.js';
import type { ToolRegistry } from './tools/registry.js';
import type { ToolExecutor } from './tools/executor.js';
import type { ContextEngine } from './context.js';
import type { MemorySystem } from './memory/interface.js';
import { randomUUID } from 'node:crypto';

export class AgentRunner {
  constructor(
    private readonly gateway: ModelGateway,
    private readonly tools: ToolRegistry,
    private readonly executor: ToolExecutor,
    private readonly contextEngine: ContextEngine
  ) {}

  /**
   * Executes an agent run until completion or max steps.
   */
  public async run(
    agent: Agent,
    input: unknown,
    memory: MemorySystem
  ): Promise<AgentRun> {
    const runId = randomUUID();
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    
    // Discover tools available to this agent (filtering can be added here)
    const availableTools = this.tools.discover({} as AgentContext).filter(t => agent.tools.includes(t.name));

    // Assemble initial context
    let context = this.contextEngine.assemble(agent, input, memory, availableTools);

    let status: AgentRun['status'] = 'running';
    let output: unknown;
    
    try {
      for (let stepCount = 0; stepCount < agent.maxSteps; stepCount++) {
        // Step 1: Call Model
        const stepStart = Date.now();
        const response = await this.gateway.complete({
          model: agent.model,
          messages: [...context.messages],
          tools: context.availableTools.length > 0 ? [...context.availableTools] : undefined,
        });
        
        const responseMessage: Message = {
          role: response.role,
          content: response.content,
          toolCalls: response.toolCalls
        };
        
        // Add model's response to context
        context = this.contextEngine.update(context, responseMessage);
        
        steps.push({
          id: randomUUID(),
          type: 'llm_call',
          input: context.messages.length,
          output: responseMessage.content,
          durationMs: Date.now() - stepStart,
          status: 'completed'
        });

        // Step 2: Check for tool calls
        if (responseMessage.toolCalls && responseMessage.toolCalls.length > 0) {
          let toolResultContent = '';

          for (const toolCall of responseMessage.toolCalls) {
            const toolStart = Date.now();
            const result = await this.executor.execute(toolCall, context);
            
            toolResultContent += `[Tool: ${toolCall.name}] ${result}\n`;
              
            steps.push({
              id: randomUUID(),
              type: 'tool_call',
              input: toolCall,
              output: result,
              durationMs: Date.now() - toolStart,
              status: 'completed'
            });
          }
          
          const toolResultMessage: Message = {
            role: 'tool',
            content: toolResultContent.trim(),
            toolCallId: responseMessage.toolCalls[0]?.id
          };
          // Add tool results to context for the next loop iteration
          context = this.contextEngine.update(context, toolResultMessage);
          continue; // Loop again so LLM can read tool results
        }

        // Step 3: No tool calls, execution finished
        status = 'completed';
        
        // Extract text content for output
        if (typeof responseMessage.content === 'string') {
          output = responseMessage.content;
        } else if (Array.isArray(responseMessage.content)) {
          output = responseMessage.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n');
        }
        
        break; // Exit loop
      }
      
      if (status === 'running') {
        // We hit maxSteps without finishing
        status = 'failed';
        output = 'Error: Agent exceeded maximum steps.';
      }
      
    } catch (error) {
      status = 'failed';
      output = error instanceof Error ? error.message : String(error);
      steps.push({
        id: randomUUID(),
        type: 'llm_call',
        input: null,
        output: null,
        durationMs: 0,
        status: 'failed',
        error: output as string
      });
    }

    return {
      id: runId,
      agentId: agent.id,
      status,
      input,
      output,
      steps,
      context,
      metadata: {
        durationMs: Date.now() - startTime
      },
      createdAt: new Date(startTime)
    };
  }
}
