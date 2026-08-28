import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['packages/*/src/**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
  },
});
