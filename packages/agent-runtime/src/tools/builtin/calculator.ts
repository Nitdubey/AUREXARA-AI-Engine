import type { ToolDefinition } from '@aurexara/ai-core';

export const CalculatorTool: ToolDefinition = {
  name: 'calculator',
  description: 'Evaluate basic math expressions securely.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'The math expression to evaluate (e.g., 2 + 2 * 4)' }
    },
    required: ['expression']
  }
};

export async function calculatorHandler(input: { expression: string }): Promise<string> {
  try {
    // Only allow basic math characters to prevent injection
    if (!/^[0-9+\-*/().\s]*$/.test(input.expression)) {
      throw new Error('Invalid characters in expression');
    }
    // eslint-disable-next-line no-eval
    const result = eval(input.expression);
    return String(result);
  } catch (error) {
    return `Error evaluating expression: ${error instanceof Error ? error.message : String(error)}`;
  }
}
