import type { SearchResult } from '../types.js';

/**
 * Interface for relevance reranking.
 */
export interface Reranker {
  /**
   * Reranks the search results.
   * @param query The original search query.
   * @param results The results to rerank.
   * @param topK The maximum number of results to return.
   */
  rerank(query: string, results: readonly SearchResult[], topK: number): Promise<readonly SearchResult[]>;
}

/**
 * A reranker that boosts results whose content contains query keywords.
 */
export class KeywordReranker implements Reranker {
  /**
   * Reranks results using a combined vector and keyword score.
   * @param query The search query.
   * @param results The initial search results.
   * @param topK The number of top results to return.
   */
  public async rerank(query: string, results: readonly SearchResult[], topK: number): Promise<readonly SearchResult[]> {
    const keywords = query.toLowerCase().split(/\W+/).filter(k => k.length > 2);
    
    if (keywords.length === 0) {
      return results.slice(0, topK);
    }

    const reranked = results.map(result => {
      const content = result.content.toLowerCase();
      let matchCount = 0;
      
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          matchCount++;
        }
      }
      
      const keywordScore = matchCount / keywords.length;
      // Combine scores: 0.7 vector + 0.3 keyword
      const combinedScore = (result.score * 0.7) + (keywordScore * 0.3);
      
      return {
        ...result,
        score: combinedScore
      };
    });

    reranked.sort((a, b) => b.score - a.score);
    return reranked.slice(0, topK);
  }
}
