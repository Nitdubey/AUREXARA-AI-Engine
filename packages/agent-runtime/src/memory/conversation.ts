import type { Message } from '@aurexara/ai-core';
import type { MemorySystem } from './interface.js';

export class ConversationMemory implements MemorySystem {
  private messages: Message[];

  constructor(initialMessages: readonly Message[] = []) {
    this.messages = [...initialMessages];
  }

  public async addMessage(message: Message): Promise<void> {
    this.messages.push(message);
  }

  public async getMessages(): Promise<readonly Message[]> {
    return [...this.messages];
  }

  public async clear(): Promise<void> {
    this.messages = [];
  }
}
