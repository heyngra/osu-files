import Realm from 'realm'
import { RealmClosedError } from '../realm-session.js'
import type { RealmSession } from '../realm-session.js'
import { EditSession } from '../edit-session.js'
import { getConfig } from '../write/factory.js'
import { ValidationError } from '../write/validate.js'
import type { DeepMutable, DeepReadonly } from '../types/readonly.js'
import '../disposable.js'

export type RealmEditHooks = {
  snapshot(realm: Realm, entity: string, primaryKey: unknown): Record<string, unknown> | null
  validate?(realm: Realm, entity: string, primaryKey: unknown): void
  log(entity: string, action: 'update', primaryKey: unknown, before: unknown, after: unknown): void
}

export type RealmWriteHooks = {
  assertWritable(): void
  validate?(entity: string, item: unknown, patch: Record<string, unknown>): void
  snapshot(entity: string, pk: unknown): Record<string, unknown> | null
  log(entity: string, action: 'update' | 'delete', pk: unknown, before: unknown, after: unknown): void
}

type WriteOperations<T> = {
  /**
   * Deletes every matched entity in one transaction.
   * @throws If a matched entity has protected references.
   * @example db.beatmaps.get.byHidden(true).write.delete()
   */
  delete(): number
  /**
   * Updates every matched entity in one transaction.
   * @throws If the patch fails validation.
   * @example db.beatmaps.get.byHidden(false).write.update({ Hidden: true })
   */
  update(patch: Record<string, unknown>): number
}

type InternalSnapshot<T> = ReadonlyArray<DeepReadonly<T>>
type InternalSurface<T, Q extends EntityQuery<T> = EntityQuery<T>> = Q & ReadonlyArray<DeepReadonly<T>>

function detach(value: unknown, seen = new Map<object, unknown>(), depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value
  if (depth > 6) return undefined
  if (value instanceof Date) return new Date(value.getTime())
  if (Buffer.isBuffer(value)) return Buffer.from(value)
  if (value instanceof Realm.BSON.UUID) return new Realm.BSON.UUID(value.toString())
  if (seen.has(value)) return seen.get(value)
  if (Array.isArray(value) || isRealmCollection(value)) {
    const result: unknown[] = []
    seen.set(value, result)
    for (const item of value as Iterable<unknown>) result.push(detach(item, seen, depth + 1))
    return result
  }
  const result: Record<string, unknown> = {}
  seen.set(value, result)
  for (const key of Object.keys(value)) {
    if ((key === 'BeatmapSet' || key === 'BeatmapInfo') && depth > 0) continue
    result[key] = detach(readProperty(value, key), seen, depth + 1)
  }
  return result
}

function isRealmCollection(value: object): value is Iterable<unknown> & { length: number } {
  return 'length' in value && Symbol.iterator in value
}

function readProperty(value: object, key: string): unknown {
  return Reflect.get(value, key)
}

export abstract class EntityQuery<T> {
  private _preds: string[] = []
  private _args: unknown[] = []
  private _sortField: string | null = null
  private _sortAscending = true
  private _cached: T[] | null = null
  private _cachedGeneration = -1
  private _editing = false
  private _editSession: EditSession<T> | null = null
  private _limit?: number
  private _detached = true

  /** Caches results after the first read. @default true */
  enableCache = true

  constructor(
    protected _realm: Realm,
    protected _name: string,
  ) {}

  [Symbol.iterator](): Iterator<DeepReadonly<T>> {
    return this._eval()[Symbol.iterator]() as Iterator<DeepReadonly<T>>
  }

  /**
   * Starts buffered editing without ending the result chain.
   *
   * @example
   * using session = db.beatmaps.get.autoEdit().byAuthorContains('Monstrata')
   * for (const beatmap of session)
   *   beatmap.Metadata!.Author!.Username = 'Sotarks'
   * // Commits automatically when the scope ends.
   */
  autoEdit(): EditSession<DeepMutable<T>> {
    const query = this._clone()
    query._editing = true
    return query.proxify() as unknown as EditSession<DeepMutable<T>>
  }

  /** Limits how many results array operations can return. @example db.beatmaps.get.sortedBy('StarRating', false).limit(10) */
  limit(n: number): this {
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('[osu-files] limit must be a non-negative safe integer')
    const q = this._clone()
    q._limit = n
    return q
  }

  /** Counts matches without applying `limit()`. */
  count(): number {
    if (this._realm.isClosed) throw new RealmClosedError()
    return (this._resultsCore(false) as { length: number }).length
  }

  /** Returns the first matching object in the current sort order, or `undefined`. */
  first(): DeepReadonly<T> | undefined {
    if (this._realm.isClosed) throw new RealmClosedError()
    const results = this._resultsCore(true) as T[]
    return results.length > 0 ? (this._detached ? detach(results[0]) as DeepReadonly<T> : results[0] as DeepReadonly<T>) : undefined
  }

  /** Returns matching read-only snapshots as a new JavaScript array. */
  toArray(): InternalSnapshot<T> {
    return this._eval().slice() as InternalSnapshot<T>
  }

  /** Returns the same snapshots as {@link toArray}. */
  all(): InternalSnapshot<T> {
    return this.toArray()
  }

  /** Commits buffered edits. */
  commit(): void {
    this._editSession?.commit()
  }

  /** Discards buffered edits. */
  rollback(): void {
    this._editSession?.rollback()
  }

  /**
   * Returns readonly Realm-backed values; this does not open a transaction or recalculate hashes.
   * Prefer {@link autoEdit} or {@link RealmSession} for writes.
   */
  live(): InternalSurface<T, this> {
    const q = this._clone()
    q._detached = false
    return q as unknown as InternalSurface<T, this>
  }

  [Symbol.dispose](): void {
    this.commit()
  }

  /**
   * Applies batch writes to the matched results.
   *
   * `write.delete()` removes every matched entity in one Realm transaction.
   * `write.update()` applies the same patch to every entity.
   *
   * @example
   * db.beatmaps.get.byAuthorContains('Monstrata').write.delete()  // deletes all matched
   * db.beatmaps.get.byBpmAbove(180).write.update({ Hidden: true })  // updates all matched
   */
  get write(): WriteOperations<T> {
    const hooks = realmWriteHooks(this._realm)
    if (!hooks) throw new Error('[osu-files] Query is not attached to a database context')
    const cfg = getConfig(this._name)
    if (!cfg) throw new Error(`[osu-files] No entity config for '${this._name}'`)
    const self = this
    return {
      delete(): number {
        hooks.assertWritable()
        const items = self._evalCore()
        if (items.length === 0) return 0
        for (const item of items) {
          for (const guard of cfg.guards ?? []) {
            const id = Reflect.get(item as object, cfg.pk)
            const refs = self._realm.objects(guard.type).filtered(guard.filter, id)
            if (refs.length > 0)
              throw new ValidationError(`Cannot delete ${cfg.name} '${String(id)}': ${refs.length} ${guard.label}(s) reference it`)
          }
        }
        const snapshots = items.map(item => ({
          id: Reflect.get(item as object, cfg.pk),
          before: hooks.snapshot(cfg.name, Reflect.get(item as object, cfg.pk)),
        }))
        const realm = self._realm as Realm & { isInTransaction?: boolean }
        const apply = () => { for (const item of items) realm.delete(item as never) }
        realm.isInTransaction ? apply() : realm.write(apply)
        for (const { id, before } of snapshots)
          hooks.log(cfg.name, 'delete', id, before, null)
        markRealmChanged(self._realm)
        return items.length
      },
      update(patch: Record<string, unknown>): number {
        hooks.assertWritable()
        const items = self._evalCore()
        if (items.length === 0) return 0
        const data: Record<string, unknown> = { ...patch }
        for (const f of cfg.strip ?? []) delete data[f]
        for (const item of items) hooks.validate?.(cfg.name, item, data)
        const snapshots = items.map(item => ({
          id: Reflect.get(item as object, cfg.pk),
          before: hooks.snapshot(cfg.name, Reflect.get(item as object, cfg.pk)),
        }))
        const realm = self._realm as Realm & { isInTransaction?: boolean }
        const apply = () => {
          for (const item of items) {
            for (const key of Object.keys(data)) {
              if (key === cfg.pk) continue
              Reflect.set(item as object, key, data[key])
            }
          }
        }
        realm.isInTransaction ? apply() : realm.write(apply)
        for (const { id, before } of snapshots)
          hooks.log(cfg.name, 'update', id, before, hooks.snapshot(cfg.name, id))
        markRealmChanged(self._realm)
        return items.length
      },
    }
  }

  /**
   * Wraps the query in a Proxy so unknown properties (slice, map, [0], etc.)
   * delegate to the evaluated result array.
   * @example db.scores.get.sortedBy('Date').slice(0, 10)
   */
  proxify(): InternalSurface<T, this> {
    const q = this
    return new Proxy(q, {
      get(_, p: string | symbol) {
        if (typeof p !== 'string' || p in q || p === 'then')
          return Reflect.get(q, p)
        const arr = q._eval()
        const val = Reflect.get(arr, p)
        return typeof val === 'function'
          ? (...args: unknown[]) => Reflect.apply(val as (...args: unknown[]) => unknown, arr, args)
          : val
      },
    }) as unknown as InternalSurface<T, this>
  }

  /** @example db.scores.get.sortedBy('Date') */
  sortedBy(field: string, ascending = true): this {
    const base = field.split('.')[0]
    const schema = this._realm.schema.find(s => s.name === this._name)
    if (schema && !(base in schema.properties))
      throw new Error(`[osu-files] Unknown sort field '${field}' on '${this._name}'`)
    const n = this._clone()
    n._sortField = field
    n._sortAscending = ascending
    return n
  }

  /** @example this._num('BPM', '>=', 180) */
  protected _num(field: string, op: string, v: number): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._numBetween('BPM', 160, 200) */
  protected _numBetween(field: string, lo: number, hi: number): this {
    const $i = this._args.length
    return this._clone()._add(`${field} >= $${$i} AND ${field} <= $${$i + 1}`, lo, hi)
  }

  /** @example this._str('DifficultyName', 'CONTAINS[c]', 'Insane') */
  protected _str(field: string, op: string, v: string): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._bool('Hidden', true) */
  protected _bool(field: string, v: boolean): this {
    return this._clone()._add(`${field} == $${this._args.length}`, v)
  }

  /** @example this._date('LastPlayed', '>', someDate) */
  protected _date(field: string, op: string, v: Date): this {
    return this._clone()._add(`${field} ${op} $${this._args.length}`, v)
  }

  /** @example this._fkEq('Metadata.ID', uuid) */
  protected _fkEq(field: string, v: unknown): this {
    return this._clone()._add(`${field} == $${this._args.length}`, v)
  }

  /** @example this._fkAny('Files.Filename', 'bg.png') */
  protected _fkAny(field: string, v: unknown): this {
    return this._clone()._add(`ANY ${field} == $${this._args.length}`, v)
  }

  /** Converts a string or BSON.UUID to BSON.UUID. */
  protected _uuid(v: string | Realm.BSON.UUID): Realm.BSON.UUID {
    return typeof v === 'string' ? new Realm.BSON.UUID(v) : v
  }

  /** @example this._byUuidPk(uuid) */
  protected _byUuidPk(v: string | Realm.BSON.UUID): this {
    return this._fkEq('ID', this._uuid(v))
  }

  private _resultsCore(applyLimit: boolean): unknown {
    if (this._realm.isClosed) throw new RealmClosedError()
    let results = this._realm.objects<T>(this._name)
    if (this._preds.length > 0) results = results.filtered(this._preds.join(' AND '), ...this._args)
    if (this._sortField) results = results.sorted(this._sortField, !this._sortAscending)
    if (applyLimit && this._limit !== undefined)
      return results.slice(0, this._limit)
    return results
  }

  private _evalCore(): T[] {
    return [...this._resultsCore(true) as Iterable<T>]
  }

  private _eval(): T[] {
    if (this._realm.isClosed) throw new RealmClosedError()
    const generation = realmGeneration(this._realm)
    if (this.enableCache && this._cached !== null && this._cachedGeneration === generation) return this._cached
    const arr = this._evalCore()
    if (this._editing) {
      const config = getConfig(this._name)
      this._editSession ??= new EditSession(this._realm, arr, {
        entity: this._name,
        primaryKey: config?.pk,
        hooks: realmEditHooks(this._realm),
      })
      return this._editSession.map(value => value)
    }
    const output = this._detached ? arr.map(item => detach(item) as T) : arr
    if (this.enableCache && this._preds.length > 0) {
      this._cached = output
      this._cachedGeneration = generation
    }
    return output
  }

  private _clone(): this {
    const clone = Object.assign(Object.create(Object.getPrototypeOf(this)), this, {
      _preds: [...this._preds],
      _args: [...this._args],
      _cached: null,
      _editSession: null,
    }) as unknown as EntityQuery<T>
    return clone.proxify() as unknown as this
  }

  private _add(pred: string, ...vals: unknown[]): this {
    this._preds.push(pred)
    this._args.push(...vals)
    return this
  }
}

const generations = new WeakMap<object, { get: () => number; mark: () => void }>()

export function registerRealmGeneration(realm: Realm, getGeneration: () => number, markGeneration: () => void): void {
  generations.set(realm, { get: getGeneration, mark: markGeneration })
}

const editHooks = new WeakMap<object, RealmEditHooks>()

export function registerRealmEditHooks(realm: Realm, hooks: RealmEditHooks): void {
  editHooks.set(realm, hooks)
}

const writeHooks = new WeakMap<object, RealmWriteHooks>()

export function registerRealmWriteHooks(realm: Realm, hooks: RealmWriteHooks): void {
  writeHooks.set(realm, hooks)
}

function realmWriteHooks(realm: Realm): RealmWriteHooks | undefined {
  return writeHooks.get(realm)
}

function realmEditHooks(realm: Realm): RealmEditHooks | undefined {
  return editHooks.get(realm)
}

export function markRealmChanged(realm: Realm): void {
  generations.get(realm)?.mark()
}

function realmGeneration(realm: Realm): number {
  return generations.get(realm)?.get() ?? 0
}
