import { ModelGateway, ProviderRegistry, ModelRouter, CostTracker } from '@aurexara/ai-core';
import { OpenAIProvider, AnthropicProvider, AmazonBedrockProvider } from '@aurexara/ai-core/providers';
import { Tracer, ConsoleExporter, StructuredLogger, MetricsCollector } from '@aurexara/observability';
import { EventBus } from '@aurexara/events';
import { validateConfig, configFromEnv } from './config.js';
import type { ResolvedConfig, EngineConfig } from './config.js';

import { AgentFacade } from './facades/agents.js';
import { KnowledgeFacade } from './facades/knowledge.js';
import { SecurityFacade } from './facades/security.js';

/**
 * Parameters for initializing the AurexaraClient.
 */
interface AurexaraClientParams {
  readonly models: ModelGateway;
  readonly events: EventBus;
  readonly tracer: Tracer;
  readonly logger: StructuredLogger;
  readonly metrics: MetricsCollector;
  readonly agents: AgentFacade;
  readonly knowledge: KnowledgeFacade;
  readonly security: SecurityFacade;
  readonly config: ResolvedConfig;
}

/**
 * The main client for the AUREXARA AI Engine.
 * Acts as the master SDK facade for all sub-modules.
 */
export class AurexaraClient {
  /** The model gateway for interacting with LLM providers. */
  public readonly models: ModelGateway;
  
  /** The central event bus. */
  public readonly events: EventBus;
  
  /** Telemetry tracer. */
  public readonly tracer: Tracer;
  
  /** Structured logger. */
  public readonly logger: StructuredLogger;
  
  /** Metrics collector. */
  public readonly metrics: MetricsCollector;
  
  /** Facade for agent operations. */
  public readonly agents: AgentFacade;
  
  /** Facade for knowledge and RAG operations. */
  public readonly knowledge: KnowledgeFacade;
  
  /** Facade for security operations. */
  public readonly security: SecurityFacade;

  /** The resolved configuration used by the engine. */
  public readonly config: ResolvedConfig;

  /**
   * Initializes a new instance of the AurexaraClient.
   * Private constructor to enforce the use of the static `create` method.
   *
   * @param params - The dependencies for the client.
   */
  private constructor(params: AurexaraClientParams) {
    this.models = params.models;
    this.events = params.events;
    this.tracer = params.tracer;
    this.logger = params.logger;
    this.metrics = params.metrics;
    this.agents = params.agents;
    this.knowledge = params.knowledge;
    this.security = params.security;
    this.config = params.config;
  }

  /**
   * Gets the cost tracker from the model gateway.
   *
   * @returns The cost tracker instance.
   */
  public get costs(): CostTracker {
    return this.models.costs;
  }

  /**
   * Creates a new AurexaraClient instance.
   *
   * @param config - The engine configuration.
   * @returns A fully initialized AurexaraClient.
   */
  public static create(config: EngineConfig): AurexaraClient {
    const resolvedConfig = validateConfig(config);
    const events = new EventBus();
    
    // Setup Observability
    const telemetry = resolvedConfig.telemetry ?? { enabled: true, logLevel: 'info', traceExporter: 'console' };
    const logger = new StructuredLogger({ service: resolvedConfig.product, level: telemetry.logLevel, pretty: true });
    const tracer = new Tracer({ 
      serviceName: resolvedConfig.product, 
      environment: resolvedConfig.environment, 
      exporters: [new ConsoleExporter()] 
    });
    const metrics = new MetricsCollector({ prefix: 'aurexara.' });

    // Setup Models
    const registry = new ProviderRegistry();
    if (resolvedConfig.providers.openai) {
      registry.register(new OpenAIProvider(resolvedConfig.providers.openai), { priority: 1, enabled: true });
    }
    if (resolvedConfig.providers.anthropic) {
      registry.register(new AnthropicProvider(resolvedConfig.providers.anthropic), { priority: 2, enabled: true });
    }
    if (resolvedConfig.providers.bedrock) {
      registry.register(new AmazonBedrockProvider(resolvedConfig.providers.bedrock), { priority: 3, enabled: true });
    }
    const gateway = new ModelGateway({ 
      registry, 
      router: new ModelRouter(), 
      costTracker: new CostTracker(), 
      config: resolvedConfig.gateway 
    });

    // Setup Facades
    const masterKey = process.env['AUREXARA_MASTER_KEY'] || 'default-insecure-master-key-32bytes!';
    const security = new SecurityFacade(masterKey, events);
    const agents = new AgentFacade(gateway, events);
    
    // Find OpenAI provider for embeddings if available
    const openAIProvider = registry.getProvider('openai') as OpenAIProvider | undefined;
    const knowledge = new KnowledgeFacade(openAIProvider);

    return new AurexaraClient({
      models: gateway, 
      events, 
      tracer, 
      logger, 
      metrics, 
      agents, 
      knowledge, 
      security, 
      config: resolvedConfig
    });
  }
  /**
   * Convenience factory to create an engine from environment variables.
   * 
   * @param product The product identifier.
   * @returns A new AurexaraClient instance.
   */
  public static fromEnv(product: string): AurexaraClient {
    const config = configFromEnv(product);
    return AurexaraClient.create(config);
  }
}
