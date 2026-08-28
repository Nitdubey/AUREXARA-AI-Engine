import { z } from 'zod';

export const EngineEnvironmentSchema = z.object({
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  AUREXARA_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  AUREXARA_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type EngineEnvironment = z.infer<typeof EngineEnvironmentSchema>;

export function parseEnvironment(env: Record<string, string | undefined>): EngineEnvironment {
  return EngineEnvironmentSchema.parse(env);
}
