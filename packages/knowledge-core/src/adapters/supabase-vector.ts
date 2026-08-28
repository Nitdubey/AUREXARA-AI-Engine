import type { VectorStore, Vector, KnowledgeScope } from '../types.js';

/**
 * A Supabase pgvector-backed VectorStore.
 */
export class SupabaseVectorStore implements VectorStore {
  private readonly url: string;
  private readonly key: string;
  private readonly tableName: string;

  /**
   * Creates a SupabaseVectorStore.
   * @param supabaseUrl The URL of the Supabase instance.
   * @param supabaseKey The service role or anon key.
   * @param tableName The table name for vectors (default 'knowledge_vectors').
   */
  constructor(supabaseUrl: string, supabaseKey: string, tableName = 'knowledge_vectors') {
    this.url = supabaseUrl.replace(/\/$/, '');
    this.key = supabaseKey;
    this.tableName = tableName;
  }

  /**
   * Upserts vectors into the store.
   * @param vectors The vectors to upsert.
   */
  public async upsert(vectors: readonly Vector[]): Promise<void> {
    if (vectors.length === 0) return;

    const rows = vectors.map(v => ({
      id: v.id,
      content: v.content,
      embedding: v.values, // assuming the column is called 'embedding'
      metadata: v.metadata ?? {},
      is_public: v.scope.public ?? false,
      user_id: v.scope.userId ?? null,
      product_id: v.scope.productId ?? null,
      organization_id: v.scope.orgId ?? null
    }));

    try {
      const response = await fetch(`${this.url}/rest/v1/${this.tableName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(rows)
      });

      if (!response.ok) {
        console.error('Supabase upsert failed', await response.text());
        // Fallback gracefully instead of crashing
      }
    } catch (err) {
      console.error('Error connecting to Supabase for upsert', err);
    }
  }

  /**
   * Searches for vectors.
   * Calls Supabase RPC function `match_vectors`.
   * Expected signature of RPC:
   * function match_vectors(
   *   query_embedding vector(1536),
   *   match_threshold float,
   *   match_count int,
   *   filter_public boolean,
   *   filter_user_id uuid,
   *   filter_product_id uuid,
   *   filter_org_id uuid
   * )
   * 
   * @param embedding The query embedding.
   * @param scope The scope to search within.
   * @param topK The maximum number of results to return.
   */
  public async search(embedding: readonly number[], scope: KnowledgeScope, topK: number): Promise<readonly Vector[]> {
    try {
      const response = await fetch(`${this.url}/rest/v1/rpc/match_vectors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`
        },
        body: JSON.stringify({
          query_embedding: embedding,
          match_threshold: 0.0,
          match_count: topK,
          filter_public: scope.public ?? false,
          filter_user_id: scope.userId ?? null,
          filter_product_id: scope.productId ?? null,
          filter_org_id: scope.orgId ?? null
        })
      });

      if (!response.ok) {
        console.error('Supabase search failed', await response.text());
        return [];
      }

      const results = await response.json() as Array<{
        id: string;
        content: string;
        embedding: number[];
        metadata: Record<string, unknown>;
        is_public: boolean;
        user_id: string | null;
        product_id: string | null;
        organization_id: string | null;
      }>;

      return results.map(r => ({
        id: r.id,
        content: r.content,
        values: r.embedding,
        metadata: r.metadata,
        scope: {
          public: r.is_public,
          userId: r.user_id ?? undefined,
          productId: r.product_id ?? undefined,
          orgId: r.organization_id ?? undefined
        }
      }));
    } catch (err) {
      console.error('Error connecting to Supabase for search', err);
      return [];
    }
  }
}
