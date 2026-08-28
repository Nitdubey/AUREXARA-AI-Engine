import { randomUUID } from 'node:crypto';
import type { Agent } from '../types.js';
// Assume AgentRunner has a run method returning AgentRun
import type { AgentRunner } from '../runner.js'; 
import type { MemorySystem } from '../memory/interface.js';

/** Conversation state */
export interface Conversation {
  readonly id: string;
  readonly agentId: string;
  readonly title: string;
  readonly turns: readonly ConversationTurn[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Record<string, unknown>;
}

/** A single turn in a conversation */
export interface ConversationTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly content: string;
  readonly timestamp: Date;
  readonly agentRunId?: string; // Links to the AgentRun that produced this
  readonly metadata?: Record<string, unknown>;
}

/** Interface for conversation storage */
export interface ConversationStore {
  save(conversation: Conversation): Promise<void>;
  load(conversationId: string): Promise<Conversation | undefined>;
  list(agentId?: string): Promise<readonly Conversation[]>;
  delete(conversationId: string): Promise<void>;
}

/** In-memory conversation store */
export class InMemoryConversationStore implements ConversationStore {
  private readonly store = new Map<string, Conversation>();

  /**
   * Save a conversation.
   * @param conversation The conversation to save.
   */
  public async save(conversation: Conversation): Promise<void> {
    this.store.set(conversation.id, conversation);
  }

  /**
   * Load a conversation by ID.
   * @param conversationId The ID of the conversation to load.
   * @returns The conversation if found, undefined otherwise.
   */
  public async load(conversationId: string): Promise<Conversation | undefined> {
    return this.store.get(conversationId);
  }

  /**
   * List conversations, optionally filtering by agent ID.
   * @param agentId Optional agent ID to filter by.
   * @returns A readonly array of conversations.
   */
  public async list(agentId?: string): Promise<readonly Conversation[]> {
    const all = Array.from(this.store.values());
    if (agentId) {
      return all.filter((conv) => conv.agentId === agentId);
    }
    return all;
  }

  /**
   * Delete a conversation by ID.
   * @param conversationId The ID of the conversation to delete.
   */
  public async delete(conversationId: string): Promise<void> {
    this.store.delete(conversationId);
  }
}

/**
 * Manages multi-turn conversations with agents.
 * Handles context window, turn tracking, and conversation persistence.
 */
export class ConversationManager {
  constructor(
    private readonly agentRunner: AgentRunner,
    private readonly store: ConversationStore
  ) {}

  /**
   * Start a new conversation with an agent.
   * @param agent The agent to start a conversation with.
   * @param title An optional title for the conversation.
   * @returns The newly created conversation.
   */
  public async startConversation(agent: Agent, title: string = 'New Conversation'): Promise<Conversation> {
    const now = new Date();
    const conversation: Conversation = {
      id: randomUUID(),
      agentId: agent.id,
      title,
      turns: [],
      createdAt: now,
      updatedAt: now,
      metadata: {},
    };

    await this.store.save(conversation);
    return conversation;
  }

  /**
   * Send a message in an existing conversation.
   * Loads conversation history, sends to agent, appends response.
   * @param conversationId The ID of the conversation.
   * @param agent The agent to interact with.
   * @param message The user's message.
   * @param memory The memory system.
   * @returns The assistant's conversation turn.
   */
  public async sendMessage(
    conversationId: string,
    agent: Agent,
    message: string,
    memory: MemorySystem
  ): Promise<ConversationTurn> {
    // 1. Load conversation from store
    const conversation = await this.store.load(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    // Append user turn
    const userTurn: ConversationTurn = {
      id: randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    const updatedTurns = [...conversation.turns, userTurn];

    // 2. Build input from conversation turns
    const contextInput = updatedTurns.map(t => `${t.role}: ${t.content}`).join('\n');

    // 3. Run agent with full context (Assuming runner.run has this signature)
    const runResult = await (this.agentRunner as any).run(agent, contextInput, memory);
    const outputContent = typeof runResult.output === 'string' 
      ? runResult.output 
      : JSON.stringify(runResult.output ?? '');

    // 4. Append assistant turn
    const assistantTurn: ConversationTurn = {
      id: randomUUID(),
      role: 'assistant',
      content: outputContent,
      timestamp: new Date(),
      agentRunId: runResult.id,
    };
    const finalTurns = [...updatedTurns, assistantTurn];

    // 5. Save conversation
    const updatedConversation: Conversation = {
      ...conversation,
      turns: finalTurns,
      updatedAt: new Date(),
    };
    await this.store.save(updatedConversation);

    // 6. Return the assistant turn
    return assistantTurn;
  }

  /**
   * Get conversation history.
   * @param conversationId The ID of the conversation.
   * @returns The conversation if found, otherwise undefined.
   */
  public async getConversation(conversationId: string): Promise<Conversation | undefined> {
    return this.store.load(conversationId);
  }

  /**
   * List all conversations, optionally filtered by agent.
   * @param agentId Optional agent ID to filter by.
   * @returns A readonly array of conversations.
   */
  public async listConversations(agentId?: string): Promise<readonly Conversation[]> {
    return this.store.list(agentId);
  }

  /**
   * Delete a conversation.
   * @param conversationId The ID of the conversation to delete.
   */
  public async deleteConversation(conversationId: string): Promise<void> {
    await this.store.delete(conversationId);
  }

  /**
   * Get the last N turns from a conversation.
   * @param conversationId The ID of the conversation.
   * @param count The number of recent turns to retrieve.
   * @returns A readonly array of the recent conversation turns.
   */
  public async getRecentTurns(conversationId: string, count: number): Promise<readonly ConversationTurn[]> {
    const conversation = await this.store.load(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    return conversation.turns.slice(-Math.max(0, count));
  }
}
