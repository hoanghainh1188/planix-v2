import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  findSensitiveWrites,
  sensitive,
  stripSensitive,
  stripSensitiveErrorParams,
  unsupportedSchemaPaths,
  type PermissionCheck,
} from './sensitive-field.ts';

const financial = sensitive('sensitive.financial.read', 'sensitive.financial.write');

const Budget = z.object({
  name: z.string(),
  budgetAtCompletion: financial(z.string()),
  lines: z.array(z.object({ label: z.string(), amount: financial(z.string()).optional() })),
  owner: z.object({ billingRate: sensitive('sensitive.financial.read')(z.string()) }).nullable(),
});

const value = {
  name: 'Website',
  budgetAtCompletion: '1000.0000',
  lines: [{ label: 'A', amount: '10.0000' }, { label: 'B' }],
  owner: { billingRate: '25.5000' },
};

const allow: PermissionCheck = () => true;
const deny: PermissionCheck = () => false;

describe('sensitive fields (FR-025)', () => {
  it('keeps sensitive keys when the permission is granted', () => {
    expect(stripSensitive(Budget, value, allow)).toEqual(value);
  });

  it('removes sensitive keys (not null) in nested objects and arrays when denied', () => {
    const stripped = stripSensitive(Budget, value, deny);
    expect(stripped).toEqual({ name: 'Website', lines: [{ label: 'A' }, { label: 'B' }], owner: {} });
    expect(Object.hasOwn(stripped, 'budgetAtCompletion')).toBe(false);
    expect(Object.hasOwn(stripped.lines[0] ?? {}, 'amount')).toBe(false);
  });

  it('does not mutate the input', () => {
    const copy = structuredClone(value);
    stripSensitive(Budget, value, deny);
    expect(value).toEqual(copy);
  });

  it('checks the declared read permission', () => {
    const seen: string[] = [];
    stripSensitive(Budget, value, (permission) => {
      seen.push(permission);
      return true;
    });
    expect(new Set(seen)).toEqual(new Set(['sensitive.financial.read']));
  });

  it('handles null nested objects', () => {
    expect(stripSensitive(Budget, { ...value, owner: null }, deny).owner).toBeNull();
  });

  it('lists unauthorized writes by path', () => {
    const input = {
      budgetAtCompletion: '1.0000',
      lines: [{ label: 'A', amount: '2.0000' }],
      owner: { billingRate: '3.0000' },
    };
    expect(findSensitiveWrites(Budget, input, deny)).toEqual([
      'budgetAtCompletion',
      'lines.0.amount',
      'owner.billingRate',
    ]);
  });

  it('treats fields without a write permission as never writable', () => {
    const input = { owner: { billingRate: '3.0000' } };
    expect(findSensitiveWrites(Budget, input, allow)).toEqual(['owner.billingRate']);
  });

  it('reports nothing when writes are allowed or absent', () => {
    expect(findSensitiveWrites(Budget, { name: 'x', budgetAtCompletion: '1.0000' }, allow)).toEqual([]);
    expect(findSensitiveWrites(Budget, { name: 'x' }, deny)).toEqual([]);
  });

  it('keeps only keys declared by the schema, for every caller (security review: raw rows)', () => {
    const raw = {
      ...value,
      internalCostBasis: '750.0000',
      lines: [{ label: 'A', amount: '10.0000', costCenter: 'CC-1' }],
      owner: { billingRate: '25.5000', salary: '9000.0000' },
    };
    for (const can of [allow, deny]) {
      const stripped = stripSensitive(Budget, raw, can);
      expect(stripped).not.toHaveProperty('internalCostBasis');
      expect(stripped.lines[0]).not.toHaveProperty('costCenter');
      expect(stripped.owner).not.toHaveProperty('salary');
    }
    expect(stripSensitive(Budget, raw, allow)).toEqual({ ...value, lines: [{ label: 'A', amount: '10.0000' }] });
  });
});

describe('sensitive values in error params (security review, option A)', () => {
  const params = {
    projectIds: ['p1', 'p2'],
    rule: 'MIN_LENGTH_12',
    count: 2,
    confirmed: false,
    name: 'Website',
    budgetAtCompletion: '1000.0000',
    row: { budgetAtCompletion: '1000.0000' },
    rows: [{ billingRate: '25.5000' }],
    missing: null,
    counts: [1, 2],
  };

  it('keeps primitives and string arrays; drops sensitive keys the caller cannot read, nested values, null and other arrays', () => {
    expect(stripSensitiveErrorParams(Budget, params, deny)).toEqual({
      projectIds: ['p1', 'p2'],
      rule: 'MIN_LENGTH_12',
      count: 2,
      confirmed: false,
      name: 'Website',
    });
  });

  it('keeps a readable sensitive primitive but never nested objects or arrays of objects', () => {
    const allowed = stripSensitiveErrorParams(Budget, params, allow);
    expect(allowed).toMatchObject({ budgetAtCompletion: '1000.0000', projectIds: ['p1', 'p2'] });
    expect(allowed).not.toHaveProperty('row');
    expect(allowed).not.toHaveProperty('rows');
  });
});

describe('sensitive fields inside unions, records and pipes (security review item 2)', () => {
  const FinancialLine = z.object({ kind: z.literal('financial'), budgetAtCompletion: financial(z.string()) });
  const TextLine = z.object({ kind: z.literal('text'), note: z.string() });

  it.each([
    ['union', z.union([FinancialLine, TextLine])],
    ['discriminated union', z.discriminatedUnion('kind', [FinancialLine, TextLine])],
  ])('strips and blocks writes through a %s', (_label, schema) => {
    const line = { kind: 'financial', budgetAtCompletion: '10.0000' };
    expect(stripSensitive(schema, line, deny)).toEqual({ kind: 'financial' });
    expect(stripSensitive(schema, line, allow)).toEqual(line);
    expect(stripSensitive(schema, { kind: 'text', note: 'n', extra: 'x' }, deny)).toEqual({ kind: 'text', note: 'n' });
    expect(findSensitiveWrites(schema, line, deny)).toEqual(['budgetAtCompletion']);
    expect(findSensitiveWrites(schema, { kind: 'text', note: 'n' }, deny)).toEqual([]);
  });

  it('strips and blocks writes through a record of objects', () => {
    const Rates = z.object({
      rates: z.record(z.string(), z.object({ billingRate: financial(z.string()), label: z.string() })),
    });
    const input = {
      rates: { r1: { billingRate: '25.5000', label: 'Dev' }, r2: { billingRate: '30.0000', label: 'QA' } },
    };
    expect(stripSensitive(Rates, input, deny)).toEqual({ rates: { r1: { label: 'Dev' }, r2: { label: 'QA' } } });
    expect(stripSensitive(Rates, input, allow)).toEqual(input);
    expect(findSensitiveWrites(Rates, input, deny)).toEqual(['rates.r1.billingRate', 'rates.r2.billingRate']);
  });

  it('strips and blocks writes through pipe and transform', () => {
    const Piped = z.object({ budgetAtCompletion: financial(z.string()), name: z.string() }).transform((v) => v);
    const input = { budgetAtCompletion: '1.0000', name: 'x' };
    expect(stripSensitive(Piped, input, deny)).toEqual({ name: 'x' });
    expect(findSensitiveWrites(Piped, input, deny)).toEqual(['budgetAtCompletion']);
    const Wrapped = z.object({ inner: z.string().pipe(z.string()), budgetAtCompletion: financial(z.string()) });
    expect(stripSensitive(Wrapped, { inner: 'a', budgetAtCompletion: '1' }, deny)).toEqual({ inner: 'a' });
  });

  it('reports schema nodes the mechanism cannot inspect, by path', () => {
    const Node: z.ZodType = z.lazy(() => z.object({ budgetAtCompletion: financial(z.string()) }));
    const Unsupported = z.object({
      tree: Node,
      both: z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })),
      pair: z.tuple([z.string()]),
      lines: z.array(z.map(z.string(), z.string())),
      ok: z.record(z.string(), z.union([z.string(), z.object({ c: z.string() })])),
    });
    expect(unsupportedSchemaPaths(Unsupported)).toEqual([
      'tree (lazy)',
      'both (intersection)',
      'pair (tuple)',
      'lines.[] (map)',
    ]);
    expect(unsupportedSchemaPaths(Budget)).toEqual([]);
  });
});
