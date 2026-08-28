import type { PromptRegistry, PromptTemplate, PromptFilter } from './types.js';

export class InMemoryPromptRegistry implements PromptRegistry {
  private templates: Map<string, PromptTemplate> = new Map();

  public register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  public async get(id: string, _version?: string): Promise<PromptTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Prompt template not found: ${id}`);
    }
    // Simplification for MVP: ignoring version for now.
    return template;
  }

  public async compile(id: string, variables: Record<string, unknown>): Promise<string> {
    const template = await this.get(id);
    let compiled = template.content;

    // Validate required variables and replace
    for (const variable of template.variables) {
      const val = variables[variable.name];
      if (variable.required && val === undefined) {
        throw new Error(`Missing required variable: ${variable.name} for prompt ${id}`);
      }
      if (val !== undefined) {
        compiled = compiled.replace(new RegExp(`{{${variable.name}}}`, 'g'), String(val));
      }
    }

    return compiled;
  }

  public async list(filter: PromptFilter): Promise<PromptTemplate[]> {
    let results = Array.from(this.templates.values());

    if (filter.id) {
      results = results.filter(t => t.id === filter.id);
    }
    if (filter.product) {
      results = results.filter(t => t.metadata.product === filter.product);
    }
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter(t => filter.tags!.every(tag => t.metadata.tags.includes(tag)));
    }

    return results;
  }
}
