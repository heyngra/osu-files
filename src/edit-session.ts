import Realm from 'realm'
import type { RealmEditHooks } from './get/base.js'
import './disposable.js'
import type { DeepReadonly } from './types/readonly.js'

type PendingChanges = Map<object, Map<PropertyKey, unknown>>
type Root = { primaryKey: unknown; before: Record<string, unknown> | null }

const proxyTargets = new WeakMap<object, object>()

function unwrap(value: unknown): unknown {
  return value && typeof value === 'object' ? proxyTargets.get(value) ?? value : value
}

function canWrap(value: unknown): value is object {
  return value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)
}

/**
 * Keeps edits in memory until you commit or dispose of the session.
 *
 * @example
 * using session = db.beatmaps.get.byAuthorContains('Monstrata').autoEdit()
 * for (const beatmap of session)
 *   beatmap.Metadata!.Author!.Username = 'Sotarks'
 * // Commits here and records rollback entries.
 */
export class EditSession<T> implements Iterable<T> {
  private readonly changes: PendingChanges = new Map()
  private readonly proxies = new WeakMap<object, object>()
  private readonly items: T[]
  private readonly roots = new WeakMap<object, Root[]>()
  private readonly rootList: Root[]
  private closed = false

   /**
   * Creates an edit session for Realm objects.
   *
   * You probably should call `autoEdit()` on a result instead of constructing it manually.
   *
   * @example
   * const session = db.beatmaps.get.byBpmAbove(180).autoEdit()
   * for (const beatmap of session) beatmap.Hidden = true
   * session.commit()
   */
  constructor(
    private readonly realm: Realm,
    objects: T[],
    private readonly options?: { entity?: string; primaryKey?: string; hooks?: RealmEditHooks },
  ) {
    this.rootList = objects.map(object => ({
      primaryKey: options?.primaryKey ? Reflect.get(object as object, options.primaryKey) : undefined,
      before: options?.entity && options.primaryKey && options.hooks
        ? options.hooks.snapshot(realm, options.entity, Reflect.get(object as object, options.primaryKey))
        : null,
    }))
    this.items = objects.map((object, index) => this.wrap(object, this.rootList[index])) as T[]
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]()
  }

  get length(): number {
    return this.items.length
  }

  at(index: number): T | undefined {
    return this.items.at(index)
  }

  forEach(callback: (value: T, index: number, array: T[]) => void): void {
    this.items.forEach(callback)
  }

  map<U>(callback: (value: T, index: number, array: T[]) => U): U[] {
    return this.items.map(callback)
  }

  private wrap<TValue>(value: TValue, root?: Root): TValue {
    if (!canWrap(value)) return value
    const existing = this.proxies.get(value)
    if (existing) return existing as TValue

    const proxy = new Proxy(value, {
      get: (target, property, receiver) => {
        const pending = this.changes.get(target)?.get(property)
        if (pending !== undefined || this.changes.get(target)?.has(property)) return pending
        return this.wrap(Reflect.get(target, property), root)
      },
      set: (target, property, newValue) => {
        if (this.closed) throw new Error('[osu-files] Edit session is closed')
        let objectChanges = this.changes.get(target)
        if (!objectChanges) {
          objectChanges = new Map()
          this.changes.set(target, objectChanges)
        }
        objectChanges.set(property, unwrap(newValue))
        if (root) {
          const roots = this.roots.get(target) ?? []
          if (!roots.includes(root)) roots.push(root)
          this.roots.set(target, roots)
        }
        return true
      },
      deleteProperty: (target, property) => {
        if (this.closed) throw new Error('[osu-files] Edit session is closed')
        let objectChanges = this.changes.get(target)
        if (!objectChanges) {
          objectChanges = new Map()
          this.changes.set(target, objectChanges)
        }
        objectChanges.set(property, undefined)
        if (root) {
          const roots = this.roots.get(target) ?? []
          if (!roots.includes(root)) roots.push(root)
          this.roots.set(target, roots)
        }
        return true
      },
    })
    this.proxies.set(value, proxy)
    proxyTargets.set(proxy, value)
    return proxy as TValue
  }

  commit(): void {
    if (this.closed) return
    if (this.changes.size > 0) {
      const changedRoots = this.rootList.filter(root => [...this.changes].some(([target]) => this.roots.get(target)?.includes(root)))
      const apply = () => {
        for (const [target, objectChanges] of this.changes) {
          for (const [property, value] of objectChanges)
            Reflect.set(target, property, value)
        }
        if (this.options?.entity && this.options.hooks) {
          for (const root of changedRoots)
            this.options.hooks.validate?.(this.realm, this.options.entity, root.primaryKey)
        }
      }
      const realm = this.realm as Realm & { isInTransaction?: boolean }
      if (realm.isInTransaction) apply()
      else realm.write(apply)
      if (this.options?.entity && this.options.hooks) {
        for (const root of changedRoots) {
          const after = this.options.hooks.snapshot(this.realm, this.options.entity, root.primaryKey)
          this.options.hooks.log(this.options.entity, 'update', root.primaryKey, root.before, after)
        }
      }
    }
    this.changes.clear()
    this.closed = true
  }

  rollback(): void {
    this.changes.clear()
    this.closed = true
  }

  [Symbol.dispose](): void {
    this.commit()
  }
}
