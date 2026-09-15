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

/** Returns a copy of `value` with every sensitive key the caller may not read removed (key deleted, not nulled). */
export function stripSensitive<T>(schema: z.ZodType, value: T, can: PermissionCheck): T {
  return strip(schema, value, can) as T;
}

function strip(schema: z.ZodType, value: unknown, can: PermissionCheck): unknown {
  const { core } = resolve(schema);
  const def = defOf(core);
  if (def.type === 'array' && def.element && Array.isArray(value)) {
    const element = def.element;
    return value.map((item) => strip(element, item, can));
  }
  if (def.type === 'object' && def.shape && isPlainObject(value)) {
    const result: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      const fieldSchema = def.shape[key];
      if (fieldSchema === undefined) {
        result[key] = fieldValue;
        continue;
      }
      const { policy } = resolve(fieldSchema);
      if (policy !== undefined && !can(policy.read)) continue;
      result[key] = strip(fieldSchema, fieldValue, can);
    }
    return result;
  }
  return value;
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
