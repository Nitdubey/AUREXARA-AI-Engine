import type { Chunker } from '../types.js';

/**
 * A sliding window chunker that splits text into overlapping chunks.
 */
export class SlidingWindowChunker implements Chunker {
  private readonly windowChars: number;
  private readonly overlapChars: number;

  /**
   * Creates a SlidingWindowChunker.
   * @param windowSize The size of the window in tokens (default 500).
   * @param overlap The size of the overlap in tokens (default 50).
   */
  constructor(windowSize = 500, overlap = 50) {
    this.windowChars = windowSize * 4;
    this.overlapChars = overlap * 4;
  }

  /**
   * Chunks text into overlapping pieces.
   * @param text The text to chunk.
   */
  public chunk(text: string): string[] {
    if (text.length === 0) {
      return [];
    }
    
    if (text.length <= this.windowChars) {
      return [text];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + this.windowChars;
      
      // Don't cut in the middle of a word if possible
      if (endIndex < text.length) {
        const nextSpace = text.indexOf(' ', endIndex);
        const prevSpace = text.lastIndexOf(' ', endIndex);
        
        if (prevSpace > startIndex && (endIndex - prevSpace) < 50) {
          endIndex = prevSpace;
        } else if (nextSpace !== -1 && (nextSpace - endIndex) < 50) {
          endIndex = nextSpace;
        }
      } else {
        endIndex = text.length;
      }

      chunks.push(text.substring(startIndex, endIndex).trim());

      if (endIndex >= text.length) {
        break;
      }

      startIndex = endIndex - this.overlapChars;
    }

    return chunks;
  }
}
