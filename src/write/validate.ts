import type Realm from 'realm'

export class ValidationError extends Error {
  constructor(message: string) { super(`[osu-files] ${message}`) }
}

export function required<T>(value: T, name: string): asserts value is NonNullable<T> {
  if (value === undefined || value === null)
    throw new ValidationError(`${name} is required`)
}

export function unique(realm: Realm, type: string, pk: string, value: unknown): void {
  if (realm.objectForPrimaryKey(type, value as never))
    throw new ValidationError(`${type} with ${pk} '${value}' already exists`)
}

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
