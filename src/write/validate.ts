import type Realm from 'realm'

/** Validation error thrown during write operations. */
export class ValidationError extends Error {
  constructor(message: string) { super(`[osu-files] ${message}`) }
}

/**
 * Asserts a value is non-null, throwing ValidationError if not.
 * @throws ValidationError if value is null/undefined.
 * @example
 * required(someValue, 'BeatmapSet.ID') // throws if null/undefined
 */
export function required<T>(value: T, name: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null)
    throw new ValidationError(`${name} is required`)
}

/**
 * Checks no existing record has the same primary key value.
 * @throws ValidationError if PK already exists.
 * @example
 * unique(realm, 'BeatmapSet', 'ID', newId) // throws if already exists
 */
export function unique(realm: Realm, type: string, pk: string, value: unknown): void {
  if (realm.objectForPrimaryKey(type, value as never))
    throw new ValidationError(`${type} with ${pk} '${value}' already exists`)
}

/**
 * Resolves a foreign key value to a Realm object, throwing if not found.
 * @returns Resolved Realm object or undefined.
 * @throws ValidationError if FK reference not found.
 * @example
 * resolveRef(realm, 'Ruleset', rulesetId) // Ruleset object or undefined
 */
export function resolveRef<T extends Realm.Object>(
  realm: Realm,
  type: string,
  value: string | number | T | undefined | null,
): T | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'object') return value as T
  const obj = realm.objectForPrimaryKey<T>(type, value as never)
  if (!obj) throw new ValidationError(`Referenced ${type} with PK '${value}' not found`)
  return obj
}
