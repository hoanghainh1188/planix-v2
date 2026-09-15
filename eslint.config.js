import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import planix from './tools/eslint-plugin-planix/src/index.ts';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '.specify/**',
      '.claude/**',
      '**/drizzle/meta/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { planix },
    rules: {
      'planix/no-number-money': ['error', { financialFileGlobs: ['**/money/**', '**/finance/**', '**/evm/**'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // packages/core is pure domain: no I/O, no framework (plan.md Structure Decision)
    files: ['packages/core/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*', 'fs', 'path', 'http', 'crypto'], message: 'packages/core must not do I/O.' },
            {
              group: ['@nestjs/*', 'pg', 'drizzle-orm', 'react', 'react-dom'],
              message: 'packages/core must stay framework-free.',
            },
          ],
        },
      ],
    },
  },
  {
    // Test-only code (fixtures, sample modules like SampleFinancialModule) must never reach the server runtime.
    files: ['apps/server/src/**/*.ts'],
    ignores: ['apps/server/src/test/**', '**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/test/**', './test/*', '../test/*'],
              message: 'apps/server/src/test is test-only; production server code must not import it.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: String.raw`ImportExpression[source.type='Literal'][source.value=/(^|\/)test\//]`,
          message: 'apps/server/src/test is test-only; production server code must not import it (dynamic import).',
        },
        {
          selector: "ImportExpression:not([source.type='Literal'])",
          message: 'Dynamic import() paths must be string literals so import boundaries can be checked.',
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Test files: HTTP response bodies from supertest are untyped JSON.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);
