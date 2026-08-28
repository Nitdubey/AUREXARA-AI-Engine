import type { Chunker } from '../types.js';

/**
 * Basic chunker that splits strings by newlines or paragraphs.
 */
export class TextChunker implements Chunker {
  private readonly maxChars: number;

  /**
   * Create a new TextChunker.
   * @param maxTokens Approximate maximum tokens per chunk.
   */
  constructor(maxTokens: number = 500) {
    this.maxChars = maxTokens * 4;
  }

  /**
   * Chunk text into smaller pieces.
   * @param text The text to chunk.
   * @returns Array of text chunks.
   */
  public chunk(text: string): string[] {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk.length + paragraph.length) > this.maxChars && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      if (paragraph.length > this.maxChars) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        chunks.push(paragraph.trim());
      } else {
        currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
