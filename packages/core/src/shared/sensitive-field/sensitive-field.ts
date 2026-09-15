import type { z } from 'zod';

/** Permission names that guard sensitive fields (contracts/authorization.md §5). */
export type SensitivePermission = 'sensitive.financial.read' | 'sensitive.financial.write';

export interface SensitiveFieldPolicy {
  readonly read: SensitivePermission;
  /** Absent = field can never be written through the API. */
  readonly write?: SensitivePermission;
}

export type PermissionCheck = (permission: SensitivePermission) => boolean;

const policies = new WeakMap<z.ZodType, SensitiveFieldPolicy>();

/** Marks a schema as a sensitive field: `budgetAtCompletion: sensitive('sensitive.financial.read', ...)(z.string())`. */
export function sensitive(read: SensitivePermission, write?: SensitivePermission) {
  return <T extends z.ZodType>(schema: T): T => {
    policies.set(schema, write === undefined ? { read } : { read, write });
    return schema;
  };
}

interface ZodInternals {
  readonly type: string;
  readonly shape?: Readonly<Record<string, z.ZodType>>;
  readonly element?: z.ZodType;
  readonly innerType?: z.ZodType;
}

const defOf = (schema: z.ZodType): ZodInternals => (schema as unknown as { _zod: { def: ZodInternals } })._zod.def;

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'readonly', 'nonoptional', 'catch', 'prefault']);

/** Sensitive policy on the schema or any wrapper around it, plus the unwrapped schema. */
function resolve(schema: z.ZodType): { policy: SensitiveFieldPolicy | undefined; core: z.ZodType } {
  let current = schema;
  let policy = policies.get(current);
  for (let def = defOf(current); WRAPPERS.has(def.type) && def.innerType; def = defOf(current)) {
    current = def.innerType;
    policy ??= policies.get(current);
  }
  return { policy, core: current };
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Returns a copy of `value` shaped by `schema`: only keys the schema declares are kept (undeclared keys such as extra
 * columns of a raw row are dropped for every caller), and every sensitive key the caller may not read is removed
 * (key deleted, not nulled).
 */
export function stripSensitive<T>(schema: z.ZodType, value: T, can: PermissionCheck, options: StripOptions = {}): T {
  return strip(schema, value, can, options.undeclaredKeys ?? 'drop') as T;
}

export interface StripOptions {
  /**
   * `drop` (default, API responses): keys the schema does not declare are removed. `keep`: only for internal copies
   * whose schema describes part of the value — audit snapshots and log redaction, which remove secrets separately.
   */
  readonly undeclaredKeys?: 'drop' | 'keep';
}

function strip(schema: z.ZodType, value: unknown, can: PermissionCheck, undeclared: 'drop' | 'keep'): unknown {
  const { core } = resolve(schema);
  const def = defOf(core);
  if (def.type === 'array' && def.element && Array.isArray(value)) {
    const element = def.element;
    return value.map((item) => strip(element, item, can, undeclared));
  }
  if (def.type === 'object' && def.shape && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      const fieldSchema = def.shape[key];
      if (fieldSchema === undefined) {
        if (undeclared === 'keep') result[key] = fieldValue;
        continue;
      }
      const { policy } = resolve(fieldSchema);
      if (policy !== undefined && !can(policy.read)) continue;
      result[key] = strip(fieldSchema, fieldValue, can, undeclared);
    }
    return result;
  }
  return value;
}

type ErrorParamValue = string | number | boolean;

const isErrorParamValue = (value: unknown): value is ErrorParamValue =>
  ['string', 'number', 'boolean'].includes(typeof value);

/**
 * Error params on a route with a sensitive response schema (security review, option A): the schema does not describe
 * error params, so only primitives and arrays of strings are kept (never nested objects — that is where a row or
 * DTO would hide), and a top-level key the schema marks sensitive is kept only when the caller may read it.
 */
export function stripSensitiveErrorParams(
  schema: z.ZodType,
  params: Readonly<Record<string, unknown>>,
  can: PermissionCheck,
): Record<string, ErrorParamValue | readonly string[]> {
  const def = defOf(resolve(schema).core);
  const result: Record<string, ErrorParamValue | readonly string[]> = {};
  for (const [key, paramValue] of Object.entries(params)) {
    const fieldSchema = def.type === 'object' ? def.shape?.[key] : undefined;
    const policy = fieldSchema === undefined ? undefined : resolve(fieldSchema).policy;
    if (policy !== undefined && !can(policy.read)) continue;
    if (isErrorParamValue(paramValue)) result[key] = paramValue;
    else if (Array.isArray(paramValue) && paramValue.every((item) => typeof item === 'string')) {
      result[key] = paramValue;
    }
  }
  return result;
}

/** Dot-paths of sensitive fields present in `input` that the caller may not write. */
export function findSensitiveWrites(schema: z.ZodType, input: unknown, can: PermissionCheck): string[] {
  const found: string[] = [];
  collectWrites(schema, input, can, [], found);
  return found;
}

function collectWrites(schema: z.ZodType, value: unknown, can: PermissionCheck, path: string[], found: string[]): void {
  const { core } = resolve(schema);
  const def = defOf(core);
  if (def.type === 'array' && def.element && Array.isArray(value)) {
    const element = def.element;
    value.forEach((item, index) => collectWrites(element, item, can, [...path, String(index)], found));
    return;
  }
  if (def.type === 'object' && def.shape && isPlainObject(value)) {
    for (const [key, fieldValue] of Object.entries(value)) {
      const fieldSchema = def.shape[key];
      if (fieldSchema === undefined || fieldValue === undefined) continue;
      const { policy } = resolve(fieldSchema);
      if (policy !== undefined && (policy.write === undefined || !can(policy.write))) {
        found.push([...path, key].join('.'));
        continue;
      }
      collectWrites(fieldSchema, fieldValue, can, [...path, key], found);
    }
  }
}
