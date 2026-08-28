import type { VectorStore, Vector, KnowledgeScope } from '../types.js';

/**
 * In-memory implementation of VectorStore.
 */
export class InMemoryVectorStore implements VectorStore {
  private readonly vectors: Vector[] = [];

  /**
   * Calculate cosine similarity between two vectors.
   */
  private cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vector dimensions do not match');
    }
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i]! * b[i]!;
      normA += a[i]! * a[i]!;
      normB += b[i]! * b[i]!;
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Check if a vector matches the given scope.
   */
  private matchesScope(vectorScope: KnowledgeScope, queryScope: KnowledgeScope): boolean {
    if (queryScope.public && !vectorScope.public) {
      return false;
    }
    if (queryScope.userId && queryScope.userId !== vectorScope.userId) {
      return false;
    }
    if (queryScope.productId && queryScope.productId !== vectorScope.productId) {
      return false;
    }
    if (queryScope.orgId && queryScope.orgId !== vectorScope.orgId) {
      return false;
    }
    return true;
  }

  /**
   * Upsert vectors into the in-memory store.
   * @param newVectors Vectors to upsert.
   */
  public async upsert(newVectors: readonly Vector[]): Promise<void> {
    for (const vector of newVectors) {
      const index = this.vectors.findIndex(v => v.id === vector.id);
      if (index !== -1) {
        this.vectors[index] = vector;
      } else {
        this.vectors.push(vector);
      }
    }
  }

  /**
   * Search for vectors in the in-memory store.
   * @param embedding The query embedding.
   * @param scope The knowledge scope to filter by.
   * @param topK Number of top results to return.
   */
  public async search(
    embedding: readonly number[],
    scope: KnowledgeScope,
    topK: number
  ): Promise<readonly Vector[]> {
    const scoredVectors = this.vectors
      .filter(v => this.matchesScope(v.scope, scope))
      .map(v => ({
        vector: v,
        score: this.cosineSimilarity(v.values, embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return scoredVectors.map(sv => sv.vector);
  }
}
