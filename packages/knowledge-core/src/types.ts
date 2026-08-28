/**
 * Scope for knowledge search.
 */
export interface KnowledgeScope {
  readonly public?: boolean;
  readonly userId?: string;
  readonly productId?: string;
  readonly orgId?: string;
}

/**
 * Query for semantic search.
 */
export interface SemanticSearchQuery {
  readonly query: string;
  readonly scope: KnowledgeScope;
  readonly topK: number;
  readonly threshold: number;
}

/**
 * Result of a semantic search.
 */
export interface SearchResult {
  readonly id: string;
  readonly content: string;
  readonly score: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Knowledge Platform interface.
 */
export interface KnowledgePlatform {
  /**
   * Ingest a document.
   * @param source The source string.
   */
  ingest(source: string): Promise<void>;

  /**
   * Search for documents.
   * @param query The search query.
   */
  search(query: SemanticSearchQuery): Promise<readonly SearchResult[]>;

  /**
   * Delete a document by ID.
   * @param docId The document ID.
   */
  delete(docId: string): Promise<void>;
}

/**
 * Vector representation.
 */
export interface Vector {
  readonly id: string;
  readonly values: readonly number[];
  readonly content: string;
  readonly metadata?: Record<string, unknown>;
  readonly scope: KnowledgeScope;
}

/**
 * Interface for vector store operations.
 */
export interface VectorStore {
  /**
   * Upsert vectors into the store.
   * @param vectors The vectors to upsert.
   */
  upsert(vectors: readonly Vector[]): Promise<void>;

  /**
   * Search for vectors.
   * @param embedding The query embedding.
   * @param scope The scope to search within.
   * @param topK The maximum number of results to return.
   */
  search(embedding: readonly number[], scope: KnowledgeScope, topK: number): Promise<readonly Vector[]>;
}

/**
 * Interface for embedding text.
 */
export interface EmbeddingProvider {
  /**
   * Embed text into a vector.
   * @param text The text to embed.
   */
  embed(text: string): Promise<readonly number[]>;
}

/**
 * Interface for chunking text.
 */
export interface Chunker {
  /**
   * Chunk text into smaller pieces.
   * @param text The text to chunk.
   */
  chunk(text: string): string[];
}

/** Metadata filter for search queries. */
export interface MetadataFilter {
  readonly field: string;
  readonly operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  readonly value: unknown;
}

/** Enhanced search query with filtering and reranking. */
export interface EnhancedSearchQuery extends SemanticSearchQuery {
  readonly filters?: readonly MetadataFilter[];
  readonly rerank?: boolean;
}

/** Document metadata for ingestion tracking. */
export interface DocumentMetadata {
  readonly id: string;
  readonly source: string;
  readonly type: 'markdown' | 'pdf' | 'code' | 'text';
  readonly chunkCount: number;
  readonly scope: KnowledgeScope;
  readonly createdAt: Date;
}
