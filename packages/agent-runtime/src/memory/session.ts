import type { SessionState } from './types.js';

/**
 * In-memory session state storage.
 */
export class SessionMemory {
  private readonly sessions = new Map<string, SessionState>();

  /**
   * Retrieves a session state by ID.
   * @param sessionId The session identifier.
   * @returns The session state if it exists, otherwise undefined.
   */
  public getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Creates a new session.
   * @param sessionId The session identifier.
   * @param agentId Optional agent identifier for the session.
   * @returns The newly created session state.
   */
  public createSession(sessionId: string, agentId?: string): SessionState {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session with id ${sessionId} already exists`);
    }

    const now = new Date();
    const session: SessionState = {
      id: sessionId,
      agentId,
      data: {},
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Merges data into an existing session.
   * @param sessionId The session identifier.
   * @param data The data to merge into the session.
   * @returns The updated session state.
   */
  public updateSession(sessionId: string, data: Record<string, unknown>): SessionState {
    const existing = this.sessions.get(sessionId);
    if (!existing) {
      throw new Error(`Session with id ${sessionId} not found`);
    }

    const updated: SessionState = {
      ...existing,
      data: {
        ...existing.data,
        ...data,
      },
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, updated);
    return updated;
  }

  /**
   * Removes a session from memory.
   * @param sessionId The session identifier.
   * @returns True if the session was deleted, false if it didn't exist.
   */
  public deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * Returns all active sessions.
   * @returns A readonly array of all session states.
   */
  public listSessions(): readonly SessionState[] {
    return Array.from(this.sessions.values());
  }
}
