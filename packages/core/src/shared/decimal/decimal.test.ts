import { describe, expect, it } from 'vitest';
import { Decimal } from './decimal.ts';

const decimalPlaces = (value: string): number => value.split('.')[1]?.length ?? 0;

describe('Decimal (constitution Principle I)', () => {
  it('parses decimal strings exactly', () => {
    expect(Decimal.of('100.1234').toString()).toBe('100.1234');
    expect(Decimal.of('-0.0001').toString()).toBe('-0.0001');
  });

  it('rejects numbers at type level and at runtime', () => {
    // @ts-expect-error — money must never be constructed from a JS number
    expect(() => Decimal.of(0.1)).toThrow(TypeError);
  });

  it('rejects strings that are not plain decimals', () => {
    for (const bad of ['abc', '', '1e5', 'NaN', 'Infinity', '1,5', ' 1']) {
      expect(() => Decimal.of(bad), bad).toThrow(TypeError);
    }
  });

  it('adds without floating-point error', () => {
    expect(Decimal.of('0.1').plus(Decimal.of('0.2')).toString()).toBe('0.3');
    expect(Decimal.of('10').minus(Decimal.of('0.0001')).toString()).toBe('9.9999');
  });

  it('keeps at least 4 decimal places for intermediate results', () => {
    const third = Decimal.of('1').dividedBy(Decimal.of('3')).toString();
    expect(decimalPlaces(third)).toBeGreaterThanOrEqual(4);
    expect(Decimal.of('1.2345').times(Decimal.of('2')).toString()).toBe('2.469');
  });

  it('does not round in toString', () => {
    expect(Decimal.of('1.23456789').toString()).toBe('1.23456789');
  });

  it('rounds half-up only for display', () => {
    expect(Decimal.of('2.345').roundHalfUp(2)).toBe('2.35');
    expect(Decimal.of('2.344').roundHalfUp(2)).toBe('2.34');
    expect(Decimal.of('-2.345').roundHalfUp(2)).toBe('-2.35');
    expect(Decimal.of('7').roundHalfUp(2)).toBe('7.00');
  });

  it('throws on division by zero instead of returning Infinity', () => {
    expect(() => Decimal.of('1').dividedBy(Decimal.of('0'))).toThrow(RangeError);
  });

  it('compares values', () => {
    expect(Decimal.of('1.10').equals(Decimal.of('1.1'))).toBe(true);
    expect(Decimal.of('2').greaterThan(Decimal.of('1.9999'))).toBe(true);
    expect(Decimal.of('1').lessThan(Decimal.of('1'))).toBe(false);
    expect(Decimal.of('0.0000').isZero()).toBe(true);
  });
});
