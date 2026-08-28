/** Model performance tier. */
export type ModelTier = 'fast' | 'balanced' | 'premium' | 'reasoning';

/** Complete capabilities description for a model. */
export interface ModelCapabilities {
  readonly id: string;                     // 'gpt-4o', 'claude-sonnet-4', etc.
  readonly provider: string;               // 'openai', 'anthropic', etc.
  readonly displayName: string;
  readonly contextWindow: number;
  readonly maxOutputTokens: number;
  readonly supportsTools: boolean;
  readonly supportsStructuredOutput: boolean;
  readonly supportsVision: boolean;
  readonly supportsStreaming: boolean;
  readonly inputCostPer1kTokens: number;
  readonly outputCostPer1kTokens: number;
  readonly tier: ModelTier;
}

/** Hints for the model router to select the optimal model. */
export interface RoutingHints {
  readonly taskType: 'classification' | 'generation' | 'reasoning' | 'coding' | 'embedding';
  readonly latencyTarget?: 'fast' | 'balanced' | 'quality';
  readonly costTarget?: 'minimum' | 'balanced' | 'best';
  readonly privacyLevel?: 'standard' | 'private' | 'enterprise';
  readonly requiredCapabilities?: readonly ('tool_calling' | 'structured_output' | 'vision' | 'long_context')[];
}

/** Health status of a provider. */
export interface ProviderHealth {
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly latencyMs: number;
  readonly errorRate: number;
  readonly lastChecked: Date;
  readonly consecutiveFailures: number;
}

/** Registry entry for a provider. */
export interface ProviderRegistryEntry {
  readonly id: string;                    // 'openai', 'anthropic', 'google'
  readonly models: ModelCapabilities[];
  health: ProviderHealth;
  readonly priority: number;
  enabled: boolean;
}
