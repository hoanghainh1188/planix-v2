import { describe, expect, it } from 'vitest';
import { ERROR_CODES } from '@planix/core/shared/errors/error-codes.ts';
import en from './en.json' with { type: 'json' };
import vi from './vi.json' with { type: 'json' };

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) => flattenKeys(nested, prefix ? `${prefix}.${key}` : key));
}

describe('i18n completeness (FR-029)', () => {
  it('has exactly the same keys in vi and en', () => {
    expect(flattenKeys(vi).sort()).toEqual(flattenKeys(en).sort());
  });

  it('translates every API error code in both languages', () => {
    for (const code of ERROR_CODES) {
      expect(vi.errors, `vi errors.${code}`).toHaveProperty(code);
      expect(en.errors, `en errors.${code}`).toHaveProperty(code);
    }
  });

  it('has no empty translations', () => {
    for (const [locale, resource] of [
      ['vi', vi],
      ['en', en],
    ] as const) {
      const empty = flattenKeys(resource).filter((key) => {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], resource);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty, locale).toEqual([]);
    }
  });
});
