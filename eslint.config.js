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
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.js', '**/*.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
);
