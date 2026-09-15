import { Decimal as DecimalJs } from 'decimal.js';

/** Isolated decimal.js instance: high precision, half-up rounding, never shared with other libraries. */
const Big = DecimalJs.clone({ precision: 34, rounding: DecimalJs.ROUND_HALF_UP });

const PLAIN_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Exact decimal value for money and financial indices (constitution Principle I).
 * Construct only from decimal strings — never from a JavaScript number.
 */
export class Decimal {
  readonly #value: DecimalJs;

  private constructor(value: DecimalJs) {
    this.#value = value;
  }

  static of(value: string): Decimal {
    if (typeof value !== 'string') {
      throw new TypeError('Decimal.of() accepts decimal strings only; numbers lose precision');
    }
    if (!PLAIN_DECIMAL.test(value)) {
      throw new TypeError(`Invalid decimal string: "${value}"`);
    }
    return new Decimal(new Big(value));
  }

  plus(other: Decimal): Decimal {
    return new Decimal(this.#value.plus(other.#value));
  }

  minus(other: Decimal): Decimal {
    return new Decimal(this.#value.minus(other.#value));
  }

  times(other: Decimal): Decimal {
    return new Decimal(this.#value.times(other.#value));
  }

  dividedBy(other: Decimal): Decimal {
    if (other.#value.isZero()) {
      throw new RangeError('Division by zero');
    }
    return new Decimal(this.#value.dividedBy(other.#value));
  }

  equals(other: Decimal): boolean {
    return this.#value.equals(other.#value);
  }

  greaterThan(other: Decimal): boolean {
    return this.#value.greaterThan(other.#value);
  }

  lessThan(other: Decimal): boolean {
    return this.#value.lessThan(other.#value);
  }

  isZero(): boolean {
    return this.#value.isZero();
  }

  /** Full-precision representation; never rounds. */
  toString(): string {
    return this.#value.toFixed();
  }

  /** Display-only rounding (half-up, away from zero on ties). */
  roundHalfUp(scale: number): string {
    return this.#value.toFixed(scale, DecimalJs.ROUND_HALF_UP);
  }
}
