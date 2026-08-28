import { describe, it, expect } from 'vitest';
import { RAGPipeline } from '../pipeline/index.js';
import { MarkdownParser } from '../parsing/markdown.js';
import { TextChunker } from '../chunking/text.js';
import { InMemoryVectorStore } from '../adapters/in-memory-vector.js';
import type { EmbeddingProvider } from '../types.js';

// Mock embedding provider that just returns simple distinct vectors
class MockEmbeddings implements EmbeddingProvider {
  public async embed(text: string): Promise<readonly number[]> {
    if (text.includes('apple')) return [1, 0, 0];
    if (text.includes('banana')) return [0, 1, 0];
    if (text.includes('orange')) return [0, 0, 1];
    return [0, 0, 0]; // default
  }
}

describe('RAGPipeline', () => {
  it('should ingest and search documents successfully', async () => {
    const parser = new MarkdownParser();
    const chunker = new TextChunker(); // Assumes it exists and exports this class
    const embeddings = new MockEmbeddings();
    const store = new InMemoryVectorStore();
    
    const pipeline = new RAGPipeline(parser, chunker, embeddings, store, { public: true });
    
    const doc1 = `
# Fruits
Here is a list of fruits.
I like apple.
I like banana.
`;
    
    await pipeline.ingest(doc1);
    
    // Now search for apple
    const results = await pipeline.search({
      query: 'apple',
      scope: { public: true },
      topK: 1,
      threshold: 0
    });
    
    expect(results.length).toBeGreaterThan(0);
    // The chunk containing apple should score highest
    const topResult = results[0]!;
    expect(topResult.content).toContain('apple');
  });
});
