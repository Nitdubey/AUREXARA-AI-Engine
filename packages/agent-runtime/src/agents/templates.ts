import { randomUUID } from 'node:crypto';
import type { Agent } from '../types.js';

/** Template category for organizing agent types */
export type AgentCategory = 'coding' | 'research' | 'analysis' | 'creative' | 'operations' | 'custom';

/** Agent template with metadata */
export interface AgentTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: AgentCategory;
  readonly systemPrompt: string;
  readonly suggestedTools: readonly string[];
  readonly suggestedModel: string;
  readonly maxSteps: number;
  readonly tags: readonly string[];
}

/**
 * Registry of pre-built agent templates.
 */
export class AgentTemplateRegistry {
  private readonly templates = new Map<string, AgentTemplate>();

  constructor() {
    this.registerDefaults();
  }

  /** 
   * Register a custom template.
   * @param template The template to register 
   */
  public register(template: AgentTemplate): void {
    if (this.templates.has(template.id)) {
      throw new Error(`Template with id ${template.id} already exists`);
    }
    this.templates.set(template.id, template);
  }

  /** 
   * Get a template by ID.
   * @param templateId The template identifier 
   */
  public get(templateId: string): AgentTemplate | undefined {
    return this.templates.get(templateId);
  }

  /** 
   * List all templates.
   */
  public listAll(): readonly AgentTemplate[] {
    return Array.from(this.templates.values());
  }

  /** 
   * List templates by category.
   * @param category The category to filter by 
   */
  public listByCategory(category: AgentCategory): readonly AgentTemplate[] {
    return this.listAll().filter(t => t.category === category);
  }

  /** 
   * Search templates by tag.
   * @param tag The tag to search for 
   */
  public searchByTag(tag: string): readonly AgentTemplate[] {
    return this.listAll().filter(t => t.tags.includes(tag));
  }

  /**
   * Create an Agent from a template.
   * Generates a unique ID and allows overriding template defaults.
   * @param templateId The ID of the template to instantiate
   * @param overrides Optional overrides for the agent properties
   * @returns The generated agent instance
   */
  public createFromTemplate(templateId: string, overrides?: Partial<Omit<Agent, 'id'>>): Agent {
    const template = this.get(templateId);
    if (!template) {
      throw new Error(`Template with id ${templateId} not found`);
    }
    
    return {
      id: randomUUID(),
      name: overrides?.name ?? template.name,
      description: overrides?.description ?? template.description,
      systemPrompt: overrides?.systemPrompt ?? template.systemPrompt,
      tools: overrides?.tools ?? template.suggestedTools,
      model: overrides?.model ?? template.suggestedModel,
      maxSteps: overrides?.maxSteps ?? template.maxSteps
    };
  }

  /** Register default templates */
  private registerDefaults(): void {
    this.register({
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Expert developer that reviews code for quality, performance and bugs.',
      category: 'coding',
      systemPrompt: 'You are an expert code reviewer. Check for bugs, anti-patterns, readability, and performance issues.',
      suggestedTools: ['read_file', 'analyze_code'],
      suggestedModel: 'gemini-1.5-pro',
      maxSteps: 10,
      tags: ['coding', 'review', 'quality']
    });

    this.register({
      id: 'researcher',
      name: 'Researcher',
      description: 'Information gathering expert.',
      category: 'research',
      systemPrompt: 'You are an expert researcher. Find, verify, and synthesize relevant information efficiently.',
      suggestedTools: ['search_web', 'read_url'],
      suggestedModel: 'gemini-1.5-pro',
      maxSteps: 15,
      tags: ['research', 'web', 'synthesis']
    });

    this.register({
      id: 'code-generator',
      name: 'Code Generator',
      description: 'Generates robust software components and architecture.',
      category: 'coding',
      systemPrompt: 'You are an expert software engineer. Generate robust, scalable, and well-documented code.',
      suggestedTools: ['write_file', 'search_code'],
      suggestedModel: 'gemini-1.5-pro',
      maxSteps: 20,
      tags: ['coding', 'generation', 'architecture']
    });

    this.register({
      id: 'data-analyst',
      name: 'Data Analyst',
      description: 'Analyzes datasets to find patterns and trends.',
      category: 'analysis',
      systemPrompt: 'You are a data analyst. Interpret data logically, run robust statistics, and find actionable insights.',
      suggestedTools: ['read_csv', 'execute_python'],
      suggestedModel: 'gemini-1.5-pro',
      maxSteps: 15,
      tags: ['data', 'analysis', 'statistics']
    });

    this.register({
      id: 'technical-writer',
      name: 'Technical Writer',
      description: 'Creates clear and comprehensive documentation.',
      category: 'creative',
      systemPrompt: 'You are a technical writer. Write clear, concise, well-formatted, and structured documentation.',
      suggestedTools: ['write_file', 'read_file'],
      suggestedModel: 'gemini-1.5-flash',
      maxSteps: 10,
      tags: ['writing', 'documentation']
    });

    this.register({
      id: 'qa-tester',
      name: 'QA Tester',
      description: 'Generates and runs comprehensive test suites.',
      category: 'operations',
      systemPrompt: 'You are a QA testing expert. Generate comprehensive test cases, edge cases, and run them.',
      suggestedTools: ['write_test', 'run_test'],
      suggestedModel: 'gemini-1.5-pro',
      maxSteps: 12,
      tags: ['testing', 'qa', 'operations']
    });
  }
}
