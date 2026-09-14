import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          root: './packages/core',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          root: './apps/server',
          include: ['src/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['./src/test/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 60_000,
          hookTimeout: 120_000,
          env: { TZ: 'UTC' },
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          root: './apps/web',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'tools',
          root: './tools/eslint-plugin-planix',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'lcov'],
      include: ['packages/core/src/**/*.ts', 'apps/server/src/features/**/*.ts', 'apps/server/src/shared/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', 'apps/server/src/test/**', 'apps/server/src/ops/**'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
