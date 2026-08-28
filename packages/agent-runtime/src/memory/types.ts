/**
 * Defines memory entry structure for long-term storage.
 */
export interface MemoryEntry {
  readonly id: string;
  readonly content: string;
  readonly embedding?: readonly number[];
  readonly metadata: Record<string, unknown>;
  readonly scope: MemoryScope;
  readonly ttl?: number; // seconds until expiry
  readonly createdAt: Date;
  readonly expiresAt?: Date;
}

/**
 * Defines the scope or partitioning for memory queries and storage.
 */
export interface MemoryScope {
  readonly userId?: string;
  readonly productId?: string;
  readonly organizationId?: string;
  readonly agentId?: string;
  readonly projectId?: string;
}

/**
 * Defines a query structure for fetching memories.
 */
export interface MemoryQuery {
  readonly query: string;
  readonly scope: MemoryScope;
  readonly topK?: number;
  readonly includeExpired?: boolean;
}

/**
 * Defines the state structure for an active session.
 */
export interface SessionState {
  readonly id: string;
  readonly agentId?: string;
  readonly data: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
