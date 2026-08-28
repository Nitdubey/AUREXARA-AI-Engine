import { randomUUID } from 'node:crypto';
import type { Message } from '@aurexara/ai-core';
import type { MemorySystem, PersistentMemoryStore } from './interface.js';
import type { MemoryEntry, MemoryQuery, MemoryScope, SessionState } from './types.js';
import type { SessionMemory } from './session.js';

/**
 * Unified facade for all memory operations.
 */
export class MemoryManager {
  private readonly conversationMemory: MemorySystem;
  private readonly sessionMemory: SessionMemory;
  private readonly persistentStore?: PersistentMemoryStore;

  /**
   * @param conversationMemory The conversation memory instance.
   * @param sessionMemory The session memory instance.
   * @param persistentStore Optional persistent store for long-term memory.
   */
  constructor(
    conversationMemory: MemorySystem,
    sessionMemory: SessionMemory,
    persistentStore?: PersistentMemoryStore,
  ) {
    this.conversationMemory = conversationMemory;
    this.sessionMemory = sessionMemory;
    this.persistentStore = persistentStore;
  }

  /**
   * Retrieves the conversation history.
   * @returns A promise resolving to a readonly array of messages.
   */
  public async getConversationHistory(): Promise<readonly Message[]> {
    return this.conversationMemory.getMessages();
  }

  /**
   * Adds a message to the conversation memory.
   * @param message The message to add.
   */
  public async addToConversation(message: Message): Promise<void> {
    await this.conversationMemory.addMessage(message);
  }

  /**
   * Retrieves the session state for a given session ID.
   * @param sessionId The session identifier.
   * @returns The session state, or undefined if not found.
   */
  public getSessionState(sessionId: string): SessionState | undefined {
    return this.sessionMemory.getSession(sessionId);
  }

  /**
   * Updates the session state for a given session ID.
   * @param sessionId The session identifier.
   * @param data The data to merge.
   * @returns The updated session state.
   */
  public updateSessionState(sessionId: string, data: Record<string, unknown>): SessionState {
    return this.sessionMemory.updateSession(sessionId, data);
  }

  /**
   * Stores a memory entry, optionally in the persistent store.
   * @param content The memory content.
   * @param scope The scope of the memory.
   * @param metadata Optional metadata.
   * @param ttl Optional time-to-live in seconds.
   * @returns The created memory entry, or undefined if no persistent store exists.
   */
  public async storeMemory(
    content: string,
    scope: MemoryScope,
    metadata: Record<string, unknown> = {},
    ttl?: number,
  ): Promise<MemoryEntry | undefined> {
    if (!this.persistentStore) {
      return undefined;
    }

    const now = new Date();
    const expiresAt = ttl ? new Date(now.getTime() + ttl * 1000) : undefined;

    const entry: MemoryEntry = {
      id: randomUUID(),
      content,
      metadata,
      scope,
      ttl,
      createdAt: now,
      expiresAt,
    };

    await this.persistentStore.store(entry);
    return entry;
  }

  /**
   * Recalls memories matching a query.
   * @param query The search query string.
   * @param scope The scope to search within.
   * @param topK The maximum number of results to return.
   * @returns A promise resolving to an array of matching memory entries.
   */
  public async recallMemory(
    query: string,
    scope: MemoryScope,
    topK?: number,
  ): Promise<readonly MemoryEntry[]> {
    if (!this.persistentStore) {
      return [];
    }

    const memoryQuery: MemoryQuery = {
      query,
      scope,
      topK,
    };

    return this.persistentStore.query(memoryQuery);
  }

  /**
   * Cleans up expired memories from the persistent store.
   * @returns A promise resolving to the number of deleted memories.
   */
  public async cleanupExpired(): Promise<number> {
    if (!this.persistentStore) {
      return 0;
    }
    return this.persistentStore.deleteExpired();
  }
}
