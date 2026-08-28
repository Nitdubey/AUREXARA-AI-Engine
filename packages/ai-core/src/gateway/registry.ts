import type { IAIProvider } from '../providers/interface.js';
import type { ModelCapabilities, ProviderRegistryEntry, ProviderHealth } from '../types/models.js';

/**
 * Registry of AI providers and their models.
 * The gateway queries this to discover available providers and capabilities.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderRegistryEntry>();
  private readonly providerInstances = new Map<string, IAIProvider>();

  /** Register a provider. */
  register(provider: IAIProvider, config: { priority: number; enabled?: boolean }): void {
    this.providerInstances.set(provider.id, provider);
    this.providers.set(provider.id, {
      id: provider.id,
      models: [...provider.models],
      health: { status: 'healthy', latencyMs: 0, errorRate: 0, lastChecked: new Date(), consecutiveFailures: 0 },
      priority: config.priority,
      enabled: config.enabled ?? true,
    });
  }

  /** Get a provider entry by ID. */
  get(providerId: string): ProviderRegistryEntry | undefined {
    return this.providers.get(providerId);
  }

  /** Get a provider instance by ID. */
  getProvider(providerId: string): IAIProvider | undefined {
    return this.providerInstances.get(providerId);
  }

  /** Get all enabled providers, sorted by priority (lower = higher priority). */
  getEnabled(): ProviderRegistryEntry[] {
    return Array.from(this.providers.values())
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  /** Find all providers that support a specific model. */
  findProviderForModel(modelId: string): ProviderRegistryEntry | undefined {
    return this.getEnabled().find(p => p.models.some(m => m.id === modelId));
  }

  /** Get all available models across all enabled providers. */
  getAllModels(): ModelCapabilities[] {
    const models = new Map<string, ModelCapabilities>();
    for (const provider of this.getEnabled()) {
      for (const model of provider.models) {
        if (!models.has(model.id)) {
          models.set(model.id, model);
        }
      }
    }
    return Array.from(models.values());
  }

  /** Update provider health status. */
  updateHealth(providerId: string, health: Partial<ProviderHealth>): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      entry.health = { ...entry.health, ...health };
    }
  }

  /** Record a failure for a provider (increments consecutiveFailures). */
  recordFailure(providerId: string): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      const consecutiveFailures = entry.health.consecutiveFailures + 1;
      const status = consecutiveFailures >= 3 ? 'down' : 'degraded';
      this.updateHealth(providerId, { consecutiveFailures, status, lastChecked: new Date() });
    }
  }

  /** Record a success for a provider (resets consecutiveFailures). */
  recordSuccess(providerId: string): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      this.updateHealth(providerId, { consecutiveFailures: 0, status: 'healthy', lastChecked: new Date() });
    }
  }

  /** Disable a provider. */
  disable(providerId: string): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      entry.enabled = false;
    }
  }

  /** Enable a provider. */
  enable(providerId: string): void {
    const entry = this.providers.get(providerId);
    if (entry) {
      entry.enabled = true;
    }
  }

  /** Check if any providers are available. */
  hasAvailableProviders(): boolean {
    return this.getEnabled().length > 0;
  }
}
