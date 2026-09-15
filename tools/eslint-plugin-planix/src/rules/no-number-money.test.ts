import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';
import { noNumberMoney } from './no-number-money.ts';

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester();

const financialOptions = [{ financialFileGlobs: ['**/money/**'] }] as const;

ruleTester.run('no-number-money', noNumberMoney, {
  valid: [
    { code: 'const budgetAtCompletion: Decimal = Decimal.of("100.0000");' },
    { code: 'const next = billingRate.plus(overtimeRate);' },
    { code: 'interface Task { durationDays: number }' },
    { code: 'const total = count + 1;' },
    { code: 'const label = "Cost: " + cost;' },
    { code: 'const n = parseFloat(input);', filename: '/repo/src/features/tasks/parse.ts' },
    {
      code: 'const budgetAtCompletion = Decimal.of(raw);',
      filename: '/repo/src/features/money/budget.ts',
      options: financialOptions,
    },
  ],
  invalid: [
    {
      code: 'const budgetAtCompletion: number = 100;',
      errors: [{ messageId: 'numberType', data: { name: 'budgetAtCompletion' } }],
    },
    {
      code: 'interface Rate { billingRate: number }',
      errors: [{ messageId: 'numberType', data: { name: 'billingRate' } }],
    },
    {
      code: 'class Contract { targetCost: number = 0 }',
      errors: [{ messageId: 'numberType', data: { name: 'targetCost' } }],
    },
    {
      code: 'function apply(actualCost: number) {}',
      errors: [{ messageId: 'numberType', data: { name: 'actualCost' } }],
    },
    {
      code: 'const x = actualCost * 2;',
      errors: [{ messageId: 'arithmetic', data: { name: 'actualCost' } }],
    },
    {
      code: 'const cv = project.earnedValue - project.actualCost;',
      errors: [{ messageId: 'arithmetic', data: { name: 'earnedValue' } }],
    },
    {
      code: 'const v = parseFloat(raw);',
      filename: '/repo/src/features/money/parse.ts',
      options: financialOptions,
      errors: [{ messageId: 'numberConversion', data: { name: 'parseFloat' } }],
    },
    {
      code: 'const v = Number(raw);',
      filename: '/repo/src/features/money/parse.ts',
      options: financialOptions,
      errors: [{ messageId: 'numberConversion', data: { name: 'Number' } }],
    },
    {
      code: 'const v = +raw;',
      filename: '/repo/src/features/money/parse.ts',
      options: financialOptions,
      errors: [{ messageId: 'numberConversion', data: { name: 'unary +' } }],
    },
    {
      code: 'const fee: number = 1;',
      options: [{ moneyIdentifiers: ['fee'] }],
      errors: [{ messageId: 'numberType', data: { name: 'fee' } }],
    },
  ],
});
