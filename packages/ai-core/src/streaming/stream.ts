import type { StreamChunk } from '../types/responses.js';
import type { TokenUsage } from '../types/cost.js';

/**
 * Wraps an async iterable of StreamChunks with utility methods.
 * Provides text accumulation, usage tracking, and abort support.
 */
export class AIStream implements AsyncIterable<StreamChunk> {
  private readonly source: AsyncIterable<StreamChunk>;
  private readonly abortController: AbortController;
  private accumulatedText = '';
  private chunkCount = 0;
  private lastUsage: TokenUsage | undefined;
  private lastModel = '';
  private lastProvider = '';

  constructor(source: AsyncIterable<StreamChunk>) {
    this.source = source;
    this.abortController = new AbortController();
  }

  /** Iterate over stream chunks. */
  async *[Symbol.asyncIterator](): AsyncIterator<StreamChunk> {
    for await (const chunk of this.source) {
      if (this.abortController.signal.aborted) break;
      this.accumulatedText += chunk.delta;
      this.chunkCount++;
      if (chunk.usage) this.lastUsage = chunk.usage;
      if (chunk.model) this.lastModel = chunk.model;
      if (chunk.provider) this.lastProvider = chunk.provider;
      yield chunk;
    }
  }

  /** Abort the stream. */
  abort(): void { this.abortController.abort(); }

  /** Consume the entire stream and return the accumulated text. */
  async toText(): Promise<string> {
    for await (const _chunk of this) { /* consume */ }
    return this.accumulatedText;
  }

  /** Get accumulated text so far. */
  get text(): string { return this.accumulatedText; }

  /** Get number of chunks received. */
  get chunks(): number { return this.chunkCount; }

  /** Get final usage (available after stream completes). */
  get usage(): TokenUsage | undefined { return this.lastUsage; }

  /** Get model ID. */
  get model(): string { return this.lastModel; }

  /** Get provider ID. */
  get provider(): string { return this.lastProvider; }
}
