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
  readonly options?: readonly z.ZodType[];
  readonly valueType?: z.ZodType;
  readonly in?: z.ZodType;
  readonly out?: z.ZodType;
}

const defOf = (schema: z.ZodType): ZodInternals => (schema as unknown as { _zod: { def: ZodInternals } })._zod.def;

const WRAPPERS = new Set(['optional', 'nullable', 'default', 'readonly', 'nonoptional', 'catch', 'prefault']);

/** Node types the mechanism cannot see into; declaring them in a sensitive schema is refused at start-up. */
const UNSUPPORTED = new Set(['lazy', 'intersection', 'tuple', 'map', 'set', 'promise', 'function', 'custom']);

/** Responses are shaped by a pipe's output, request bodies by its input; a transform has no inspectable output. */
type Side = 'output' | 'input';

/** Sensitive policy on the schema or any wrapper/pipe around it, plus the unwrapped schema. */
function resolve(
  schema: z.ZodType,
  side: Side = 'output',
): { policy: SensitiveFieldPolicy | undefined; core: z.ZodType } {
  let current = schema;
  let policy = policies.get(current);
  for (;;) {
    const def = defOf(current);
    let next: z.ZodType | undefined;
    if (WRAPPERS.has(def.type)) next = def.innerType;
    else if (def.type === 'pipe' && def.in && def.out) {
      next = side === 'input' || defOf(def.out).type === 'transform' ? def.in : def.out;
    }
    if (next === undefined) break;
    current = next;
    policy ??= policies.get(current);
  }
  return { policy, core: current };
}

/** Every concrete alternative a value may match: union options are flattened (a key is sensitive if any says so). */
function alternatives(schemas: readonly z.ZodType[], side: Side): ZodInternals[] {
  return schemas.flatMap((schema) => {
    const def = defOf(resolve(schema, side).core);
    return def.type === 'union' && def.options ? alternatives(def.options, side) : [def];
  });
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Field schemas for `key` across object alternatives, or record value schemas when no object declares it. */
function fieldSchemasFor(defs: readonly ZodInternals[], key: string): z.ZodType[] {
  const declared = defs.flatMap((def) => (def.type === 'object' && def.shape?.[key] ? [def.shape[key]] : []));
  if (declared.length > 0) return declared;
  return defs.flatMap((def) => (def.type === 'record' && def.valueType ? [def.valueType] : []));
}

const hasObjectShape = (defs: readonly ZodInternals[]) => defs.some((d) => d.type === 'object' || d.type === 'record');

/**
 * Paths of schema nodes the sensitive-field mechanism cannot inspect (lazy, intersection, tuple, map, set…).
 * A sensitive field inside one would silently escape stripping and write checks (security review).
 */
export function unsupportedSchemaPaths(schema: z.ZodType): string[] {
  const found: string[] = [];
  const visited = new Set<z.ZodType>();
  const walk = (node: z.ZodType, path: string): void => {
    if (visited.has(node)) return;
    visited.add(node);
    const def = defOf(node);
    const label = path === '' ? '(root)' : path;
    if (UNSUPPORTED.has(def.type)) {
      found.push(`${label} (${def.type})`);
      return;
    }
    if (WRAPPERS.has(def.type) && def.innerType) walk(def.innerType, path);
    if (def.type === 'pipe') {
      if (def.in) walk(def.in, path);
      if (def.out && defOf(def.out).type !== 'transform') walk(def.out, path);
    }
    if (def.type === 'object' && def.shape) {
      for (const [key, field] of Object.entries(def.shape)) walk(field, path === '' ? key : `${path}.${key}`);
    }
    if (def.type === 'array' && def.element) walk(def.element, `${path}.[]`.replace(/^\./, ''));
    if (def.type === 'record' && def.valueType) walk(def.valueType, `${path}.{}`.replace(/^\./, ''));
    if (def.type === 'union' && def.options) for (const option of def.options) walk(option, path);
  };
  walk(schema, '');
  return found;
}

export function stripSensitive<T>(schema: z.ZodType, value: T, can: PermissionCheck, options: StripOptions = {}): T {
  return strip([schema], value, can, options.undeclaredKeys ?? 'drop') as T;
}

export interface StripOptions {
  /**
   * `drop` (default, API responses): keys the schema does not declare are removed. `keep`: only for internal copies
   * whose schema describes part of the value — audit snapshots and log redaction, which remove secrets separately.
   */
  readonly undeclaredKeys?: 'drop' | 'keep';
}

function strip(
  schemas: readonly z.ZodType[],
  value: unknown,
  can: PermissionCheck,
  undeclared: 'drop' | 'keep',
): unknown {
  const defs = alternatives(schemas, 'output');
  if (Array.isArray(value)) {
    const elements = defs.flatMap((def) => (def.type === 'array' && def.element ? [def.element] : []));
    return elements.length > 0 ? value.map((item) => strip(elements, item, can, undeclared)) : value;
  }
  if (isPlainObject(value) && hasObjectShape(defs)) {
    const result: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      const fieldSchemas = fieldSchemasFor(defs, key);
      if (fieldSchemas.length === 0) {
        if (undeclared === 'keep') result[key] = fieldValue;
        continue;
      }
      if (fieldSchemas.some((field) => isUnreadable(field, can))) continue;
      result[key] = strip(fieldSchemas, fieldValue, can, undeclared);
    }
    return result;
  }
  return value;
}

function isUnreadable(field: z.ZodType, can: PermissionCheck): boolean {
  const { policy } = resolve(field);
  return policy !== undefined && !can(policy.read);
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
  const defs = alternatives([schema], 'output');
  const result: Record<string, ErrorParamValue | readonly string[]> = {};
  for (const [key, paramValue] of Object.entries(params)) {
    if (fieldSchemasFor(defs, key).some((field) => isUnreadable(field, can))) continue;
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
  collectWrites([schema], input, can, [], found);
  return found;
}

function collectWrites(
  schemas: readonly z.ZodType[],
  value: unknown,
  can: PermissionCheck,
  path: string[],
  found: string[],
): void {
  const defs = alternatives(schemas, 'input');
  if (Array.isArray(value)) {
    const elements = defs.flatMap((def) => (def.type === 'array' && def.element ? [def.element] : []));
    if (elements.length > 0)
      value.forEach((item, index) => collectWrites(elements, item, can, [...path, String(index)], found));
    return;
  }
  if (!isPlainObject(value) || !hasObjectShape(defs)) return;
  for (const [key, fieldValue] of Object.entries(value)) {
    const fieldSchemas = fieldSchemasFor(defs, key);
    if (fieldSchemas.length === 0 || fieldValue === undefined) continue;
    const unwritable = fieldSchemas.some((field) => {
      const { policy } = resolve(field, 'input');
      return policy !== undefined && (policy.write === undefined || !can(policy.write));
    });
    if (unwritable) {
      found.push([...path, key].join('.'));
      continue;
    }
    collectWrites(fieldSchemas, fieldValue, can, [...path, key], found);
  }
}
