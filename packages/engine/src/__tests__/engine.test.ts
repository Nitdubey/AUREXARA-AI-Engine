import { describe, it, expect, vi, afterEach } from 'vitest';
import { AurexaraClient } from '../engine.js';
import { z } from 'zod';

describe('AurexaraClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('constructor — valid config creates client instance', () => {
    const client = AurexaraClient.create({
      product: 'test-product',
      environment: 'development',
      providers: {
        openai: { apiKey: 'test-key' }
      }
    });

    expect(client).toBeDefined();
    expect(client.config.product).toBe('test-product');
    expect(client.config.environment).toBe('development');
  });

  it('constructor — invalid config throws ZodError', () => {
    expect(() => {
      AurexaraClient.create({
        product: 'test',
        providers: {}
      } as any);
    }).toThrow(z.ZodError);
  });

  it('constructor — client has facades', () => {
    const client = AurexaraClient.create({
      product: 'test-product',
      providers: { openai: { apiKey: 'key' } }
    });

    expect(client.agents).toBeDefined();
    expect(client.knowledge).toBeDefined();
    expect(client.security).toBeDefined();
    expect(client.models).toBeDefined();
  });

  it('fromEnv() — reads from environment variables', () => {
    vi.stubEnv('OPENAI_API_KEY', 'env-key');
    vi.stubEnv('AUREXARA_ENV', 'staging');

    const engine = AurexaraClient.fromEnv('env-product');

    expect(engine.config.product).toBe('env-product');
    expect(engine.config.environment).toBe('staging');
    expect(engine.config.providers.openai?.apiKey).toBe('env-key');
  });

  it('costs getter — returns cost tracker from gateway', () => {
    const client = AurexaraClient.create({
      product: 'test-product',
      providers: { openai: { apiKey: 'key' } }
    });

    expect(client.costs).toBeDefined();
    expect(typeof client.costs.getTotalSpend).toBe('function');
  });
});
