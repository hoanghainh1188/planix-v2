import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noLiteralString } from './no-literal-string.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
});
const tsx = (code: string) => ({ code, filename: 'page.tsx' });

ruleTester.run('no-literal-string (FR-029, SC-007)', noLiteralString, {
  valid: [
    tsx("const A = () => <h1>{t('projects.title')}</h1>;"),
    tsx(
      "const A = () => <button aria-label={t('projectMembers.removeFor', { email })}>{t('projectMembers.remove')}</button>;",
    ),
    tsx('const A = () => <option value="en">{label}</option>;'),
    tsx('const A = () => <div className="panel dialog" id="x" role="status" type="button" />;'),
    tsx("const A = () => <p>{' '}·{' '}—{' '}{count}</p>;"),
    tsx('const A = () => <td>{member.email}</td>;'),
    tsx('const A = () => <p>{`${a} ${b}`}</p>;'),
    tsx('const A = () => <>\n  {children}\n</>;'),
    tsx("const A = () => <p>{saved ? t('settings.saved') : t('settings.unsaved')}</p>;"),
    tsx("const A = () => <p>{role === 'admin' && t('members.admin')}</p>;"),
    tsx("const A = () => <p className={open ? 'panel open' : 'panel'}>{name ?? t('members.unknown')}</p>;"),
    tsx('const A = () => <div role="progressbar" aria-valuetext={t(\'progress.half\')} />;'),
  ],
  invalid: [
    { ...tsx('const A = () => <h1>Settings</h1>;'), errors: [{ messageId: 'jsxText' }] },
    { ...tsx('const A = () => <p>Cài đặt ngôn ngữ</p>;'), errors: [{ messageId: 'jsxText' }] },
    { ...tsx("const A = () => <p>{'No projects yet.'}</p>;"), errors: [{ messageId: 'jsxText' }] },
    { ...tsx('const A = () => <p>{`Loading…`}</p>;'), errors: [{ messageId: 'jsxText' }] },
    {
      ...tsx('const A = () => <button aria-label="Close dialog" title="Close">x</button>;'),
      errors: [{ messageId: 'jsxAttribute' }, { messageId: 'jsxAttribute' }, { messageId: 'jsxText' }],
    },
    { ...tsx('const A = () => <input placeholder="Email" />;'), errors: [{ messageId: 'jsxAttribute' }] },
    { ...tsx('const A = () => <img alt="Logo" />;'), errors: [{ messageId: 'jsxAttribute' }] },
    // Code review: literals inside conditional and logical expressions, and aria-valuetext.
    {
      ...tsx("const A = () => <p>{saved ? 'Saved' : t('settings.unsaved')}</p>;"),
      errors: [{ messageId: 'jsxText' }],
    },
    {
      ...tsx("const A = () => <p>{saved ? t('settings.saved') : `Not saved`}</p>;"),
      errors: [{ messageId: 'jsxText' }],
    },
    { ...tsx("const A = () => <p>{loading && 'Loading'}</p>;"), errors: [{ messageId: 'jsxText' }] },
    { ...tsx("const A = () => <p>{name || 'Unknown'}</p>;"), errors: [{ messageId: 'jsxText' }] },
    { ...tsx("const A = () => <p>{name ?? 'Unknown'}</p>;"), errors: [{ messageId: 'jsxText' }] },
    {
      ...tsx("const A = () => <p>{a ? (b ? 'One' : 'Two') : t('x')}</p>;"),
      errors: [{ messageId: 'jsxText' }, { messageId: 'jsxText' }],
    },
    {
      ...tsx("const A = () => <button aria-label={open ? 'Close' : 'Open'} />;"),
      errors: [{ messageId: 'jsxAttribute' }, { messageId: 'jsxAttribute' }],
    },
    {
      ...tsx('const A = () => <div role="progressbar" aria-valuetext="Half done" />;'),
      errors: [{ messageId: 'jsxAttribute' }],
    },
  ],
});
