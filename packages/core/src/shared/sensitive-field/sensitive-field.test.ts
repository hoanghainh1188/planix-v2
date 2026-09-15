import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { findSensitiveWrites, sensitive, stripSensitive, type PermissionCheck } from './sensitive-field.ts';

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
});
