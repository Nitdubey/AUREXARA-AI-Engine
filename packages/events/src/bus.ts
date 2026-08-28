import type {
  EngineEvent,
  EngineEventType,
  EventHandler,
  WildcardEventHandler,
  Unsubscribe,
} from './types.js';

export interface Logger {
  error(message: string, error?: unknown): void;
}

export class EventBus {
  private readonly handlers = new Map<EngineEventType, Set<EventHandler<any>>>();
  private readonly wildcardHandlers = new Set<WildcardEventHandler>();

  constructor(private readonly logger?: Logger) {}

  /**
   * Subscribe to a specific engine event type.
   * @param eventType The type of event to subscribe to.
   * @param handler The function to call when the event is emitted.
   * @returns A function to unsubscribe this specific handler.
   */
  public subscribe<T extends EngineEventType>(
    eventType: T,
    handler: EventHandler<T>
  ): Unsubscribe {
    let typeHandlers = this.handlers.get(eventType);
    if (!typeHandlers) {
      typeHandlers = new Set();
      this.handlers.set(eventType, typeHandlers);
    }
    
    typeHandlers.add(handler as EventHandler<any>);

    return () => {
      const currentHandlers = this.handlers.get(eventType);
      if (currentHandlers) {
        currentHandlers.delete(handler as EventHandler<any>);
        if (currentHandlers.size === 0) {
          this.handlers.delete(eventType);
        }
      }
    };
  }

  /**
   * Subscribe to all engine events. Useful for observability and logging.
   * @param handler The function to call when any event is emitted.
   * @returns A function to unsubscribe this specific wildcard handler.
   */
  public subscribeAll(handler: WildcardEventHandler): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /**
   * Emit an event to all subscribed handlers, including wildcard handlers.
   * Handler failures are isolated, caught, and logged (if a logger is provided),
   * allowing subsequent handlers to execute.
   * @param event The engine event to emit.
   */
  public async emit(event: EngineEvent): Promise<void> {
    const promises: Promise<void>[] = [];

    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        promises.push(this.executeHandler(handler, event));
      }
    }

    for (const handler of this.wildcardHandlers) {
      promises.push(this.executeHandler(handler, event));
    }

    await Promise.all(promises);
  }

  /**
   * Remove all subscriptions (both type-specific and wildcard).
   */
  public removeAllListeners(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  /**
   * Get the number of listeners.
   * @param eventType If provided, returns the number of listeners for that specific type.
   *                  Otherwise, returns the total number of listeners (including wildcards).
   */
  public listenerCount(eventType?: EngineEventType): number {
    if (eventType) {
      const count = this.handlers.get(eventType)?.size ?? 0;
      return count + this.wildcardHandlers.size;
    }

    let total = this.wildcardHandlers.size;
    for (const typeHandlers of this.handlers.values()) {
      total += typeHandlers.size;
    }
    return total;
  }

  private async executeHandler(handler: Function, event: EngineEvent): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      if (this.logger) {
        this.logger.error(`Event handler failed for event type: ${event.type}`, error);
      }
    }
  }
}
