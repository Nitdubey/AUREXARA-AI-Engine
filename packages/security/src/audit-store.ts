import { randomUUID } from 'node:crypto';
import type { AuditEvent } from './types.js';

/** Query options for audit log retrieval */
export interface AuditQuery {
  readonly tenantId?: string;
  readonly userId?: string;
  readonly action?: string;
  readonly resource?: string;
  readonly status?: AuditEvent['status'];
  readonly since?: Date;
  readonly until?: Date;
  readonly limit?: number;
}

/** Interface for audit storage backends */
export interface AuditStore {
  /**
   * Append a new audit event.
   * @param event The audit event to store
   */
  append(event: AuditEvent): Promise<void>;

  /**
   * Query the stored audit events.
   * @param query The filter conditions
   * @returns List of matching audit events
   */
  query(query: AuditQuery): Promise<readonly AuditEvent[]>;

  /**
   * Count the number of audit events matching the query.
   * @param query The filter conditions
   * @returns Total number of matching events
   */
  count(query: AuditQuery): Promise<number>;
}

/** In-memory audit store */
export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  /**
   * Append to events array (immutable — never modify existing events)
   * @param event The audit event
   */
  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  /**
   * Query the events array
   * @param query The query parameters
   * @returns Matching audit events
   */
  async query(query: AuditQuery): Promise<readonly AuditEvent[]> {
    let results = this.events.filter(event => {
      if (query.tenantId && event.tenant.platformId !== query.tenantId) return false;
      if (query.userId && event.tenant.userId !== query.userId) return false;
      if (query.action && event.action !== query.action) return false;
      if (query.resource && event.resource !== query.resource) return false;
      if (query.status && event.status !== query.status) return false;
      if (query.since && event.timestamp < query.since) return false;
      if (query.until && event.timestamp > query.until) return false;
      return true;
    });

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.limit !== undefined) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  /**
   * Count matching events
   * @param query The query parameters
   * @returns Total count
   */
  async count(query: AuditQuery): Promise<number> {
    const results = await this.query({ ...query, limit: undefined });
    return results.length;
  }
}

/**
 * Enhanced audit logger that uses a pluggable AuditStore.
 */
export class AuditLogger {
  constructor(private readonly store: AuditStore) {}

  /**
   * Log an audit event.
   * Auto-generates id and timestamp.
   * @param event Details of the event
   * @returns The generated audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEvent> {
    const fullEvent: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
    };
    await this.store.append(fullEvent);
    return fullEvent;
  }

  /**
   * Query the audit log.
   * @param query The search query
   * @returns A list of events
   */
  async query(query: AuditQuery): Promise<readonly AuditEvent[]> {
    return this.store.query(query);
  }

  /**
   * Get recent events for a tenant.
   * @param tenantId The tenant ID
   * @param limit Max number of events to fetch
   * @returns Recent audit events
   */
  async getRecentEvents(tenantId: string, limit: number = 100): Promise<readonly AuditEvent[]> {
    return this.store.query({ tenantId, limit });
  }
}
