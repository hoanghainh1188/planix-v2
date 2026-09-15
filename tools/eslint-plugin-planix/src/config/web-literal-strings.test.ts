import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PROBE = '__literal_probe__';

async function literalStringMessages(filePath: string, code: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfig: [{ files: [`**/${PROBE}*`], ...tseslint.configs.disableTypeChecked }],
  });
  const [result] = await eslint.lintText(code, { filePath: `${ROOT}${filePath}` });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'planix/no-literal-string').map((m) => m.message);
}

describe('no hard-coded display strings in web screens (T118, FR-029, SC-007)', () => {
  it('flags literal text in apps/web/src/features', async () => {
    const messages = await literalStringMessages(
      `apps/web/src/features/organization-access/${PROBE}.tsx`,
      'export const Probe = () => <h1>Settings</h1>;\n',
    );
    expect(messages).toHaveLength(1);
  });

  it.each(['apps/web/src/app', 'apps/web/src/shared/ui'])('flags literal text in %s (code review)', async (dir) => {
    const messages = await literalStringMessages(
      `${dir}/${PROBE}.tsx`,
      'export const Probe = () => <h1>Settings</h1>;\n',
    );
    expect(messages).toHaveLength(1);
  });

  it('does not apply outside feature screens (e.g. tests)', async () => {
    const messages = await literalStringMessages(
      `apps/web/src/features/organization-access/${PROBE}.test.tsx`,
      'export const Probe = () => <h1>Settings</h1>;\n',
    );
    expect(messages).toEqual([]);
  });
});
