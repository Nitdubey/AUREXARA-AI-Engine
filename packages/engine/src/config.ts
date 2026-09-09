import { z } from 'zod';

/** Provider-specific configuration schema. */
const ProviderConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional(),
  timeout: z.number().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  organization: z.string().optional(),
});

/** Telemetry configuration schema. */
const TelemetryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  logLevel: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  traceExporter: z.enum(['console', 'none']).default('console'),
});

/** Gateway configuration schema. */
const GatewayConfigSchema = z.object({
  defaultModel: z.string().optional(),
  enableFallback: z.boolean().default(true),
  maxFallbackAttempts: z.number().int().positive().default(3),
});

/** Root engine configuration schema. */
export const EngineConfigSchema = z.object({
  /** Product identifier (e.g., 'aurecode', 'jobmatchai'). */
  product: z.string().min(1, 'Product identifier is required'),

  /** Deployment environment. */
  environment: z.enum(['development', 'staging', 'production']).default('development'),

  /** Provider configurations. At least one provider is required. */
  providers: z.object({
    openai: ProviderConfigSchema.optional(),
    anthropic: ProviderConfigSchema.optional(),
    google: ProviderConfigSchema.optional(),
    bedrock: ProviderConfigSchema.optional(),
    mantle: ProviderConfigSchema.optional(),
  }),

  /** Gateway configuration. */
  gateway: GatewayConfigSchema.optional(),

  /** Telemetry configuration. */
  telemetry: TelemetryConfigSchema.optional(),
});

/** Inferred TypeScript type from the Zod schema. */
export type EngineConfig = z.infer<typeof EngineConfigSchema>;

/** Validated and resolved configuration with all defaults applied. */
export type ResolvedConfig = z.output<typeof EngineConfigSchema>;

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;

/**
 * Validates engine configuration.
 * @throws {z.ZodError} If validation fails
 */
export function validateConfig(input: unknown): ResolvedConfig {
  return EngineConfigSchema.parse(input);
}

/**
 * Creates engine configuration from environment variables.
 * Reads OPENAI_API_KEY, ANTHROPIC_API_KEY, AUREXARA_ENV, AUREXARA_LOG_LEVEL.
 */
export function configFromEnv(product: string): EngineConfig {
  const providers: EngineConfig['providers'] = {};

  const openaiKey = process.env['OPENAI_API_KEY'];
  if (openaiKey) {
    providers.openai = { apiKey: openaiKey };
  }

  const anthropicKey = process.env['ANTHROPIC_API_KEY'];
  if (anthropicKey) {
    providers.anthropic = { apiKey: anthropicKey };
  }

  const googleKey = process.env['GOOGLE_AI_API_KEY'];
  if (googleKey) {
    providers.google = { apiKey: googleKey };
  }

  const bedrockKey = process.env['AWS_BEARER_TOKEN_BEDROCK'];
  const awsAccessKey = process.env['AWS_ACCESS_KEY_ID'];
  if (bedrockKey || awsAccessKey) {
    // apiKey can be the bearer token or a placeholder when using IAM credentials
    providers.bedrock = { apiKey: bedrockKey || 'iam-credentials' };
  }

  // Mantle provider (OpenAI-compatible endpoint) — Arsenal Plan
  if (bedrockKey) {
    providers.mantle = { 
      apiKey: bedrockKey,
      baseUrl: `https://bedrock-mantle.${process.env['BEDROCK_REGION'] || 'us-east-1'}.api.aws/v1`,
    };
  }

  return {
    product,
    environment: (process.env['AUREXARA_ENV'] as EngineConfig['environment']) ?? 'development',
    providers,
    telemetry: {
      enabled: true,
      logLevel: (process.env['AUREXARA_LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error' | 'fatal') ?? 'info',
      traceExporter: 'console',
    },
  };
}
