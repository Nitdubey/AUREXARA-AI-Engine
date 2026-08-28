import type { Message } from '@aurexara/ai-core';
import type { MemoryEntry, MemoryQuery } from './types.js';

/** Short-term conversation memory. */
export interface MemorySystem {
  /**
   * Adds a message to the memory.
   * @param message The message to add.
   */
  addMessage(message: Message): Promise<void>;

  /**
   * Retrieves all messages currently in memory.
   * @returns A promise resolving to a readonly array of messages.
   */
  getMessages(): Promise<readonly Message[]>;

  /**
   * Clears the current memory.
   */
  clear(): Promise<void>;
}

/** Long-term persistent memory store (backed by database). */
export interface PersistentMemoryStore {
  store(entry: MemoryEntry): Promise<void>;
  query(query: MemoryQuery): Promise<readonly MemoryEntry[]>;
  delete(entryId: string): Promise<void>;
  deleteExpired(): Promise<number>;
}
