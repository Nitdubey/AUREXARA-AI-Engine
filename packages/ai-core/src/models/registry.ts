import type { ModelCapabilities, ModelTier } from '../types/models.js';

/** Model deployment status */
export type ModelStatus = 'available' | 'deprecated' | 'preview' | 'disabled';

/** Model origin */
export type ModelOrigin = 'provider' | 'fine-tuned' | 'custom' | 'distilled';

/** Extended model entry with deployment metadata */
export interface ModelEntry {
  readonly capabilities: ModelCapabilities;
  readonly status: ModelStatus;
  readonly origin: ModelOrigin;
  readonly version: string;         // Semantic version e.g. '1.0.0'
  readonly deployedAt: Date;
  readonly tags: readonly string[];  // e.g. ['production', 'internal']
  readonly parentModelId?: string;   // For fine-tuned: which base model
  readonly metadata: Record<string, unknown>;
}

/** Query for searching models */
export interface ModelQuery {
  readonly provider?: string;
  readonly tier?: ModelTier;
  readonly status?: ModelStatus;
  readonly origin?: ModelOrigin;
  readonly tag?: string;
  readonly supportsTools?: boolean;
  readonly supportsVision?: boolean;
  readonly minContextWindow?: number;
}

/**
 * Central registry for all models across all providers.
 * Provides discovery, filtering, and lifecycle management.
 */
export class ModelRegistry {
  private readonly models = new Map<string, ModelEntry>();

  /**
   * Register a model.
   * @param entry - The model entry to register.
   */
  public register(entry: ModelEntry): void {
    if (!entry.capabilities?.id) {
      throw new Error('Model entry must have a valid capability ID.');
    }
    this.models.set(entry.capabilities.id, entry);
  }

  /**
   * Get a model by ID.
   * @param modelId - The ID of the model.
   * @returns The model entry or undefined if not found.
   */
  public get(modelId: string): ModelEntry | undefined {
    return this.models.get(modelId);
  }

  /**
   * Remove a model.
   * @param modelId - The ID of the model to remove.
   * @returns True if the model was removed, false otherwise.
   */
  public remove(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  /**
   * List all models.
   * @returns A list of all registered models.
   */
  public listAll(): readonly ModelEntry[] {
    return Array.from(this.models.values());
  }

  /**
   * Search models by query.
   * @param query - The query to filter models.
   * @returns A list of models matching the query.
   */
  public search(query: ModelQuery): readonly ModelEntry[] {
    return this.listAll().filter(entry => {
      if (query.provider !== undefined && entry.capabilities.provider !== query.provider) return false;
      if (query.tier !== undefined && entry.capabilities.tier !== query.tier) return false;
      if (query.status !== undefined && entry.status !== query.status) return false;
      if (query.origin !== undefined && entry.origin !== query.origin) return false;
      if (query.tag !== undefined && !entry.tags.includes(query.tag)) return false;
      if (query.supportsTools !== undefined && entry.capabilities.supportsTools !== query.supportsTools) return false;
      if (query.supportsVision !== undefined && entry.capabilities.supportsVision !== query.supportsVision) return false;
      if (query.minContextWindow !== undefined && entry.capabilities.contextWindow < query.minContextWindow) return false;
      
      return true;
    });
  }

  /**
   * List models by provider.
   * @param provider - The provider name.
   * @returns A list of models for the given provider.
   */
  public listByProvider(provider: string): readonly ModelEntry[] {
    return this.search({ provider });
  }

  /**
   * List models by status.
   * @param status - The status to filter by.
   * @returns A list of models with the given status.
   */
  public listByStatus(status: ModelStatus): readonly ModelEntry[] {
    return this.search({ status });
  }

  /**
   * Update model status (e.g., deprecate).
   * @param modelId - The ID of the model to update.
   * @param status - The new status.
   */
  public updateStatus(modelId: string, status: ModelStatus): void {
    const entry = this.models.get(modelId);
    if (!entry) {
      throw new Error(`Model with ID '${modelId}' not found.`);
    }
    this.models.set(modelId, { ...entry, status });
  }

  /**
   * Get all available model IDs.
   * @returns A list of available model IDs.
   */
  public getAvailableModelIds(): readonly string[] {
    return this.listByStatus('available').map(entry => entry.capabilities.id);
  }
}
