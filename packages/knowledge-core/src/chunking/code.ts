import type { Chunker } from '../types.js';

/**
 * A code-aware chunker that splits code by function/class boundaries,
 * keeps imports with the first chunk, and preserves function signatures
 * with their bodies.
 */
export class CodeChunker implements Chunker {
  private readonly maxChars: number;

  /**
   * Creates a CodeChunker.
   * @param maxTokens The maximum number of tokens per chunk (default 400).
   *                  Assumes roughly 4 characters per token.
   */
  constructor(maxTokens = 400) {
    this.maxChars = maxTokens * 4;
  }

  /**
   * Chunks text into smaller pieces.
   * @param text The text to chunk.
   */
  public chunk(text: string): string[] {
    const lines = text.split('\n');
    const chunks: string[] = [];
    let currentChunk = '';
    let isFirstChunk = true;

    // A simple regex to detect imports/requires
    const importRegex = /^(?:import|export|require\(|const\s+.*=\s+require\()/;
    // A regex to detect start of function or class
    const blockStartRegex = /^(?:export\s+)?(?:default\s+)?(?:class|function|async\s+function|const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*)\s*=>)/;

    for (const line of lines) {
      const isImport = importRegex.test(line.trim());
      const isBlockStart = blockStartRegex.test(line.trim());

      // If we are accumulating imports for the first chunk
      if (isFirstChunk && isImport) {
        currentChunk += line + '\n';
        continue;
      }

      if (isBlockStart && currentChunk.length > 0) {
        if (currentChunk.length > this.maxChars) {
          // If the accumulated chunk is too big, split it by line counts
          this.splitByLength(currentChunk.trim(), chunks);
        } else {
          chunks.push(currentChunk.trim());
        }
        currentChunk = '';
        isFirstChunk = false;
      }

      currentChunk += line + '\n';

      // If line count fallback is needed for really long blocks
      if (currentChunk.length >= this.maxChars && !isFirstChunk) {
         this.splitByLength(currentChunk.trim(), chunks);
         currentChunk = '';
      }
    }

    if (currentChunk.trim().length > 0) {
      if (currentChunk.length > this.maxChars) {
        this.splitByLength(currentChunk.trim(), chunks);
      } else {
        chunks.push(currentChunk.trim());
      }
    }

    return chunks;
  }

  private splitByLength(text: string, chunks: string[]): void {
    const lines = text.split('\n');
    let current = '';
    for (const line of lines) {
      if ((current.length + line.length + 1) > this.maxChars && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += line + '\n';
    }
    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }
  }
}
