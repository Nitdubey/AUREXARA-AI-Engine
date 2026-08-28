import { 
  AgentRunner, 
  AgentTemplateRegistry, 
  AgentStreamManager, 
  ConversationManager,
  InMemoryConversationStore,
  AgentLifecycleManager,
  AgentCoordinator,
  ToolRegistry,
  ToolExecutor,
  ContextEngine,
  ToolChainExecutor,
  WorkflowExecutor,
  CheckpointManager,
  InMemoryCheckpointStore,
  HandoffManager,
  ApprovalManager,
  WebSearchTool,
  webSearchHandler,
  CalculatorTool,
  calculatorHandler
} from '@aurexara/agent-runtime';
import type { ModelGateway } from '@aurexara/ai-core';
import type { EventBus } from '@aurexara/events';

/**
 * Interface representing the workflow managers within the agent facade.
 */
export interface WorkflowManagers {
  /** Executor for managing agent workflows */
  readonly executor: WorkflowExecutor;
  /** Manager for handling execution checkpoints */
  readonly checkpoints: CheckpointManager;
  /** Manager for handling agent handoffs */
  readonly handoffs: HandoffManager;
  /** Manager for handling human-in-the-loop approvals */
  readonly approvals: ApprovalManager;
}

/**
 * Facade class that provides a simplified, cohesive interface for the
 * agent runtime capabilities, abstracting the initialization and wiring
 * of core agent components.
 */
export class AgentFacade {
  /** Handles the core execution of agents */
  public readonly runner: AgentRunner;
  
  /** Manages agent templates */
  public readonly templates: AgentTemplateRegistry;
  
  /** Handles streaming interactions with agents */
  public readonly streaming: AgentStreamManager;
  
  /** Manages agent conversations and state */
  public readonly conversations: ConversationManager;
  
  /** Manages the lifecycle hooks of agents */
  public readonly lifecycle: AgentLifecycleManager;
  
  /** Coordinates multiple agents interacting with each other */
  public readonly coordinator: AgentCoordinator;
  
  /** Central registry for available tools */
  public readonly tools: ToolRegistry;
  
  /** Handles execution of tool chains */
  public readonly chains: ToolChainExecutor;
  
  /** Sub-facade for workflow-related operations */
  public readonly workflows: WorkflowManagers;

  /**
   * Initializes a new instance of the AgentFacade.
   *
   * @param models - The ModelGateway instance for interacting with AI models.
   * @param events - The EventBus instance for system-wide event communication.
   */
  constructor(models: ModelGateway, _events: EventBus) {
    // 1. Initialize core tools
    this.tools = new ToolRegistry();
    this.tools.register(WebSearchTool, webSearchHandler);
    this.tools.register(CalculatorTool, calculatorHandler);

    // 2. Initialize Runner
    const executor = new ToolExecutor(this.tools);
    const contextEngine = new ContextEngine();
    this.runner = new AgentRunner(models, this.tools, executor, contextEngine);

    // 3. Initialize high-level managers
    this.templates = new AgentTemplateRegistry();

    this.streaming = new AgentStreamManager();
    this.conversations = new ConversationManager(
      this.runner, 
      new InMemoryConversationStore()
    );
    this.lifecycle = new AgentLifecycleManager();
    this.coordinator = new AgentCoordinator(this.runner);
    this.chains = new ToolChainExecutor();

    // 4. Initialize Workflows
    const checkpointStore = new InMemoryCheckpointStore();
    const checkpoints = new CheckpointManager(checkpointStore);
    const handoffs = new HandoffManager(this.runner);
    const approvals = new ApprovalManager();

    this.workflows = {
      checkpoints,
      handoffs,
      approvals,
      executor: new WorkflowExecutor(
        this.runner,
        { enableCheckpoints: true }, // config
        checkpoints,
        approvals,
        handoffs
      )
    };
  }
}
