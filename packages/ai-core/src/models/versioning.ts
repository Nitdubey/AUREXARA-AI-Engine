import type { ModelCapabilities } from '../types/models.js';

/** A specific version of a model */
export interface ModelVersion {
  readonly modelId: string;
  readonly version: string;      // Semver e.g. '1.2.3'
  readonly capabilities: ModelCapabilities;
  readonly releaseDate: Date;
  readonly changelog: string;
  readonly isActive: boolean;    // Is this the current active version?
  readonly isDeprecated: boolean;
}

/** Version comparison result */
export type VersionCompare = 'newer' | 'older' | 'same';

/**
 * Tracks model versions and manages version lifecycle.
 */
export class ModelVersionManager {
  private readonly versions = new Map<string, ModelVersion[]>(); // modelId -> versions

  /**
   * Register a new version of a model.
   * Automatically marks as active if no other version is active.
   * @param version - The version to register.
   */
  public registerVersion(version: ModelVersion): void {
    const existing = this.versions.get(version.modelId) ?? [];
    
    // Check if any version is already active
    const hasActive = existing.some(v => v.isActive);
    
    const newVersion: ModelVersion = {
      ...version,
      isActive: !hasActive ? true : version.isActive
    };
    
    // If the new version is explicitly active, deactivate others
    if (newVersion.isActive && hasActive) {
      this.versions.set(version.modelId, existing.map(v => ({ ...v, isActive: false })).concat(newVersion));
    } else {
      this.versions.set(version.modelId, [...existing, newVersion]);
    }
  }

  /**
   * Get all versions of a model, sorted by version descending.
   * @param modelId - The model ID.
   * @returns A sorted list of versions.
   */
  public getVersions(modelId: string): readonly ModelVersion[] {
    const existing = this.versions.get(modelId) ?? [];
    return [...existing].sort((a, b) => this.compareVersions(a.version, b.version) === 'newer' ? -1 : 1);
  }

  /**
   * Get the active version of a model.
   * @param modelId - The model ID.
   * @returns The active version, if any.
   */
  public getActiveVersion(modelId: string): ModelVersion | undefined {
    const existing = this.versions.get(modelId) ?? [];
    return existing.find(v => v.isActive);
  }

  /**
   * Set a specific version as active (deactivates others).
   * @param modelId - The model ID.
   * @param version - The version string to activate.
   * @returns True if successful, false if the version doesn't exist.
   */
  public setActiveVersion(modelId: string, version: string): boolean {
    const existing = this.versions.get(modelId);
    if (!existing) return false;
    
    let found = false;
    const updated = existing.map(v => {
      if (v.version === version) {
        found = true;
        return { ...v, isActive: true };
      }
      return { ...v, isActive: false };
    });
    
    if (found) {
      this.versions.set(modelId, updated);
      return true;
    }
    
    return false;
  }

  /**
   * Deprecate a specific version.
   * @param modelId - The model ID.
   * @param version - The version string to deprecate.
   * @returns True if successful, false if the version doesn't exist.
   */
  public deprecateVersion(modelId: string, version: string): boolean {
    const existing = this.versions.get(modelId);
    if (!existing) return false;
    
    let found = false;
    const updated = existing.map(v => {
      if (v.version === version) {
        found = true;
        return { ...v, isDeprecated: true };
      }
      return v;
    });
    
    if (found) {
      this.versions.set(modelId, updated);
      return true;
    }
    
    return false;
  }

  /**
   * Get the latest non-deprecated version.
   * @param modelId - The model ID.
   * @returns The latest non-deprecated version, if any.
   */
  public getLatestVersion(modelId: string): ModelVersion | undefined {
    const versions = this.getVersions(modelId);
    return versions.find(v => !v.isDeprecated);
  }

  /**
   * Compare two semver strings.
   * @param v1 - The first version string.
   * @param v2 - The second version string.
   * @returns 'newer' if v1 > v2, 'older' if v1 < v2, 'same' if equal.
   */
  public compareVersions(v1: string, v2: string): VersionCompare {
    const parse = (v: string) => v.split('.').map(n => parseInt(n, 10));
    const parts1 = parse(v1);
    const parts2 = parse(v2);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 > p2) return 'newer';
      if (p1 < p2) return 'older';
    }
    
    return 'same';
  }

  /**
   * Get version history count.
   * @param modelId - The model ID.
   * @returns The number of versions registered for the model.
   */
  public getVersionCount(modelId: string): number {
    return (this.versions.get(modelId) ?? []).length;
  }
}
