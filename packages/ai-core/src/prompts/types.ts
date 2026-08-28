export interface PromptVariable {
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean';
  required: boolean;
}

export interface Guardrail {
  type: 'input_filter' | 'output_filter' | 'topic_restriction' | 'pii_detection';
  config: Record<string, unknown>;
  action: 'block' | 'warn' | 'log';
}

export interface PromptTemplate {
  id: string;
  version: string;
  content: string;
  variables: PromptVariable[];
  guardrails: Guardrail[];
  metadata: {
    product?: string;
    agent?: string;
    environment?: string;
    tags: string[];
  };
}

export interface PromptFilter {
  id?: string;
  product?: string;
  tags?: string[];
}

export interface PromptRegistry {
  get(id: string, version?: string): Promise<PromptTemplate>;
  compile(id: string, variables: Record<string, unknown>): Promise<string>;
  list(filter: PromptFilter): Promise<PromptTemplate[]>;
}
