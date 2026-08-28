import { 
  TextChunker, 
  CodeChunker, 
  SlidingWindowChunker,
  MarkdownParser,
  CodeParser,
  PDFParser,
  InMemoryVectorStore,
  SupabaseVectorStore,
  OpenAIEmbeddings,
  RAGPipeline,
  KeywordReranker
} from '@aurexara/knowledge-core';
import type { VectorStore } from '@aurexara/knowledge-core';
import type { IAIProvider } from '@aurexara/ai-core';

/**
 * Facade class that simplifies interactions with the knowledge and memory subsystems,
 * providing easy access to document parsing, chunking, embeddings, and RAG pipelines.
 * 
 * Automatically detects Supabase environment variables and uses SupabaseVectorStore
 * for persistent storage. Falls back to InMemoryVectorStore if Supabase is not configured.
 */
export class KnowledgeFacade {
  /** Vector store for embeddings (Supabase or InMemory) */
  public readonly vectorStore: VectorStore;

  /** Whether persistent storage (Supabase) is active */
  public readonly isPersistent: boolean;
  
  /** Pipeline for processing and ingesting documents */
  public readonly pipeline: RAGPipeline;
  
  /** Chunking utilities */
  public readonly chunkers: {
    readonly text: TextChunker;
    readonly code: CodeChunker;
    readonly slidingWindow: SlidingWindowChunker;
  };
  
  /** Document parsing utilities */
  public readonly parsers: {
    readonly markdown: MarkdownParser;
    readonly code: CodeParser;
    readonly pdf: PDFParser;
  };
  
  /** Search result reranker */
  public readonly reranker: KeywordReranker;

  /**
   * Initializes a new instance of the KnowledgeFacade.
   *
   * @param embeddingsProvider - An optional AI provider instance to use for generating embeddings.
   *                             If not provided, a fallback mock embedder configuration will be used.
   */
  constructor(_embeddingsProvider?: IAIProvider) {
    const embedder = new OpenAIEmbeddings('');

    // Auto-detect Supabase configuration from environment
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (supabaseUrl && supabaseKey) {
      this.vectorStore = new SupabaseVectorStore(supabaseUrl, supabaseKey);
      this.isPersistent = true;
      console.log('[KnowledgeFacade] ✅ Using Supabase pgvector (persistent storage)');
    } else {
      this.vectorStore = new InMemoryVectorStore();
      this.isPersistent = false;
      console.log('[KnowledgeFacade] ⚠️ Using InMemory vector store (data will not persist across restarts)');
    }
    
    this.chunkers = {
      text: new TextChunker(),
      code: new CodeChunker(),
      slidingWindow: new SlidingWindowChunker(500, 50)
    };

    this.parsers = {
      markdown: new MarkdownParser(),
      code: new CodeParser(),
      pdf: new PDFParser()
    };

    this.reranker = new KeywordReranker();

    this.pipeline = new RAGPipeline(
      this.parsers.markdown,
      this.chunkers.text,
      embedder,
      this.vectorStore,
      { orgId: 'default' }
    );
  }

  /**
   * Ingests a markdown document into the knowledge base.
   * 
   * @param content - The markdown content to ingest.
   * @param _metadata - Optional metadata for the document (reserved for future use).
   */
  public async ingestMarkdown(content: string, _metadata?: Record<string, unknown>): Promise<void> {
    await this.pipeline.ingest(content);
  }

  /**
   * Searches the knowledge base using semantic similarity.
   *
   * @param query - The search query string.
   * @param limit - The maximum number of results to return (default: 5).
   * @returns An array of search results.
   */
  public async search(query: string, limit: number = 5): Promise<unknown> {
    return this.pipeline.search({ query, topK: limit, threshold: 0, scope: { orgId: 'default' } });
  }
}
