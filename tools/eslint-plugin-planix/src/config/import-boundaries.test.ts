import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PROBE = '__boundary_probe__';

/** Lints a virtual file with the repository's eslint.config.js (type-aware rules off: the probe is in no tsconfig). */
async function restrictedImportMessages(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: [{ files: [`**/${PROBE}*`], ...tseslint.configs.disableTypeChecked }],
  });
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-imports').map((m) => m.message);
}

describe('test code never reaches production server code (code review Phase 9)', () => {
  it.each([
    [
      `apps/server/src/features/organization-access/${PROBE}.ts`,
      "import { x } from '../../test/sample-financial.module.ts';",
    ],
    [`apps/server/src/shared/${PROBE}.ts`, "import { x } from '../test/seed.ts';"],
    [`apps/server/src/${PROBE}.ts`, "import { SampleFinancialModule } from './test/sample-financial.module.ts';"],
  ])('forbids %s from importing test code', async (filePath, code) => {
    const messages = await restrictedImportMessages(filePath, `${code}\nexport const y = x;\n`);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('test-only');
  });

  it.each([
    [`apps/server/src/features/organization-access/${PROBE}.test.ts`, "import { x } from '../../test/seed.ts';"],
    [`apps/server/src/test/${PROBE}.ts`, "import { x } from './seed.ts';"],
    [`apps/server/src/features/organization-access/${PROBE}.ts`, "import { x } from '../../shared/db/client.ts';"],
  ])('allows %s', async (filePath, code) => {
    expect(await restrictedImportMessages(filePath, `${code}\nexport const y = x;\n`)).toEqual([]);
  });
});
