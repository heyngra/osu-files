import { tmpdir } from 'os'
import { join } from 'path'
import { accessSync, constants, writeFileSync, readdirSync, unlinkSync, statSync, existsSync, mkdirSync } from 'fs'
import Realm from 'realm'
import { markRealmChanged } from '../get/base.js'

/** Log action types for change tracking. */
export enum LogAction {
  Create = 'create',
  Update = 'update',
  Delete = 'delete',
}

/**
 * A logged rollback entry with metadata about a single Realm write operation.
 * Each entry can be inspected, serialised to string, or passed to rollback methods.
 */
export class RollbackEntry {
  readonly timestamp: number
  readonly entity: string
  readonly action: LogAction
  readonly primaryKey: string
  readonly entryId: string
  readonly before: Record<string, unknown> | null
  readonly after: Record<string, unknown> | null

  constructor(raw: {
    timestamp: number
    entity: string
    action: LogAction
    primaryKey: unknown
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  }) {
    this.timestamp = raw.timestamp
    this.entity = raw.entity
    this.action = raw.action
    this.primaryKey = String(raw.primaryKey)
    this.entryId = `${raw.timestamp}_${raw.entity}_${raw.action}_${String(raw.primaryKey)}`
    this.before = raw.before
    this.after = raw.after
  }

  toString(): string {
    const when = new Date(this.timestamp).toISOString().slice(0, 19).replace('T', ' ')
    return `[${when}] ${this.action} ${this.entity} (${this.entryId})`
  }
}

/** Options for configuring the rollback logger. */
export type RollbackOptions = {
  /** @default true */
  enabled?: boolean
  /** Max total log file size in bytes. @default 1048576 */
  maxSize?: number
  /** Max log file age in milliseconds. @default 86400000 */
  maxAge?: number
}

type ConfigResolver = (name: string) => {
  pk: string
  name: string
  fks?: Record<string, string>
} | undefined

function identifier(obj: object): string {
  return String((obj as Record<string, unknown>).ID ?? (obj as Record<string, unknown>).Hash ?? (obj as Record<string, unknown>).ShortName ?? '')
}

function serialize(obj: unknown, seen?: Set<string>): unknown {
  seen = seen ?? new Set()
  if (obj === null || obj === undefined) return null
  if (typeof obj !== 'object') return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(v => serialize(v, seen))
  if (typeof (obj as any)[Symbol.iterator] === 'function')
    return [...(obj as Iterable<unknown>)].map(v => serialize(v, seen))
  if (typeof (obj as any)?.toHexString === 'function')
    return (obj as any).toHexString()

  const id = identifier(obj)
  if (id && seen.has(id)) return id
  if (id) seen.add(id)

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    try {
      const val = (obj as Record<string, unknown>)[key]
      if (typeof val === 'function') continue
      result[key] = serialize(val, seen)
    } catch {
      result[key] = null
    }
  }
  return result
}

/**
 * Logs change entries for rollback support. Writes each entry as a JSON file in a temp directory.
 *
 * @param options - Rollback configuration.
 * @param options.enabled - Enable rollback logging. @default true
 * @param options.maxSize - Max total log file size in bytes. @default 1048576
 * @param options.maxAge - Max log file age in milliseconds. @default 86400000
 */
export class RollbackLogger {
  private entryList: RollbackEntry[] = []
  private entrySize = 0
  private logDir: string
  private realm: Realm
  private resolveConfig: ConfigResolver
  private readonly maxSize: number
  enabled: boolean

  constructor(options: RollbackOptions | undefined, realm: Realm, resolveConfig: ConfigResolver) {
    const opts = { enabled: true, maxSize: 1_048_576, maxAge: 86_400_000, ...options }
    this.enabled = opts.enabled
    this.maxSize = opts.maxSize
    this.logDir = join(tmpdir(), 'osu-files-rollback')
    this.realm = realm
    this.resolveConfig = resolveConfig

    if (this.enabled) {
      if (!this.checkWritable())
        return

      if (!existsSync(this.logDir))
        mkdirSync(this.logDir, { recursive: true })

      this.purge(opts.maxSize, opts.maxAge)
    }
  }

  get entries(): readonly RollbackEntry[] { return this.entryList }

  /** Marks the current end of the rollback log for an operation. */
  checkpoint(): number {
    return this.entryList.length
  }

  private checkWritable(): boolean {
    try {
      accessSync(tmpdir(), constants.W_OK)
      return true
    } catch {
      console.warn('[osu-files] Temp directory not writable, rollback disabled')
      this.enabled = false
      return false
    }
  }

  private purge(maxSize: number, maxAge: number): void {
    try {
      const now = Date.now()
      let files = readdirSync(this.logDir).map(f => {
        const p = join(this.logDir, f)
        try {
          const s = statSync(p)
          return { name: f, path: p, size: s.size, mtime: s.mtimeMs }
        } catch { return null }
      }).filter((f): f is NonNullable<typeof f> => f !== null)

      const old = files.filter(f => (now - f.mtime) > maxAge)
      old.forEach(f => { try { unlinkSync(f.path) } catch {} })

      files = files.filter(f => (now - f.mtime) <= maxAge)
      const totalSize = files.reduce((s, f) => s + f.size, 0)

      if (totalSize > maxSize) {
        files.sort((a, b) => a.mtime - b.mtime)
        let excess = totalSize - maxSize
        for (const f of files) {
          if (excess <= 0) break
          try { unlinkSync(f.path); excess -= f.size } catch {}
        }
      }
    } catch {}
  }

  log(entity: string, action: LogAction, primaryKey: unknown, before: unknown, after: unknown): void {
    if (!this.enabled) return

    const entry = new RollbackEntry({
      timestamp: Date.now(),
      entity,
      action,
      primaryKey,
      before: before ? serialize(before) as Record<string, unknown> : null,
      after: after ? serialize(after) as Record<string, unknown> : null,
    })

    this.entryList.push(entry)
    this.entrySize += JSON.stringify(entry).length

    try {
      const ts = new Date(entry.timestamp).toISOString().replace(/[:.]/g, '-')
      const file = join(this.logDir, `${ts}_${entity}_${action}_${entry.primaryKey}.json`)
      writeFileSync(file, JSON.stringify(entry, null, 2), 'utf-8')
    } catch {}

    if (this.entrySize > this.maxSize)
      this.entryList.splice(0, Math.ceil(this.entryList.length * 0.3))
  }

  /** Rollback all entries in reverse order, then clear the log. */
  rollbackAll(): void {
    for (let i = this.entryList.length - 1; i >= 0; i--)
      this.applyRevert(this.entryList[i])
    this.entryList = []
    this.entrySize = 0
  }

  /** Rollback the most recent entry. Returns false if log is empty. */
  rollbackLast(): boolean {
    if (this.entryList.length === 0) return false
    const entry = this.entryList.pop()!
    this.entrySize -= JSON.stringify(entry).length
    this.applyRevert(entry)
    return true
  }

  /**
   * Rollback all entries at or after the given timestamp, in reverse order.
   * Older entries are kept.
   * @returns Number of entries rolled back.
   */
  rollbackTo(timestamp: number): number {
    const idx = this.entryList.findIndex(e => e.timestamp >= timestamp)
    if (idx === -1) return 0

    const toRevert = this.entryList.splice(idx)
    this.entrySize -= toRevert.reduce((s, e) => s + JSON.stringify(e).length, 0)
    for (let i = toRevert.length - 1; i >= 0; i--)
      this.applyRevert(toRevert[i])
    return toRevert.length
  }

  /** Rolls back entries created after a checkpoint. */
  rollbackSince(checkpoint: number): number {
    const toRevert = this.takeSince(checkpoint)
    for (let i = toRevert.length - 1; i >= 0; i--) this.applyRevert(toRevert[i])
    return toRevert.length
  }

  /** Discards entries created after a failed Realm transaction. */
  discardSince(checkpoint: number): number {
    return this.takeSince(checkpoint).length
  }

  private takeSince(checkpoint: number): RollbackEntry[] {
    const index = Math.max(0, Math.min(checkpoint, this.entryList.length))
    const entries = this.entryList.splice(index)
    this.entrySize -= entries.reduce((size, entry) => size + JSON.stringify(entry).length, 0)
    return entries
  }

  private applyRevert(entry: RollbackEntry): void {
    const cfg = this.resolveConfig(entry.entity)
    if (!cfg) return

    this.realm.write(() => {
      switch (entry.action) {
        case LogAction.Create: {
          const pk = this.entryPrimaryKey(entry)
          const obj = (this.realm as any).objectForPrimaryKey(entry.entity, pk)
          if (obj) this.realm.delete(obj)
          break
        }
        case LogAction.Update: {
          if (!entry.before) break
          const pk = this.entryPrimaryKey(entry)
          const obj = (this.realm as any).objectForPrimaryKey(entry.entity, pk)
          if (!obj) break
          for (const [key, value] of Object.entries(entry.before)) {
            if (key === cfg.pk) continue
            if (cfg.fks?.[key])
              (obj as any)[key] = this.resolveFkRef(value, cfg.fks[key])
            else
              (obj as any)[key] = value
          }
          break
        }
        case LogAction.Delete: {
          if (!entry.before) break
          const data: Record<string, unknown> = { ...entry.before }
          if (cfg.pk && typeof data[cfg.pk] === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(data[cfg.pk] as string))
            data[cfg.pk] = new Realm.BSON.UUID(data[cfg.pk] as string)
          for (const [field, fkType] of Object.entries(cfg.fks ?? {})) {
            if (field in data)
              data[field] = this.resolveFkRef(data[field], fkType)
          }
          this.realm.create(entry.entity, data as never)
          break
        }
      }
    })
    markRealmChanged(this.realm)
  }

  private entryPrimaryKey(entry: RollbackEntry): string | number | Realm.BSON.UUID {
    const pk = entry.primaryKey
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pk))
      return new Realm.BSON.UUID(pk)
    if (/^\d+$/.test(pk))
      return parseInt(pk, 10)
    return pk
  }

  private resolveFkRef(value: unknown, fkType: string): unknown {
    if (value === null || value === undefined) return null
      if (typeof value === 'string')
      return (this.realm as any).objectForPrimaryKey(fkType, value) ?? null
    if (typeof value === 'object') {
      const fkCfg = this.resolveConfig(fkType)
      if (!fkCfg) return value
      const pkVal = (value as Record<string, unknown>)[fkCfg.pk]
      if (pkVal !== undefined && pkVal !== null) {
        if (typeof pkVal === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(pkVal))
          return (this.realm as any).objectForPrimaryKey(fkType, new Realm.BSON.UUID(pkVal)) ?? null
        return (this.realm as any).objectForPrimaryKey(fkType, pkVal) ?? null
      }
    }
    return value
  }

  /** Disable logging and clear all stored entries without reverting. */
  disable(): void {
    this.enabled = false
    this.entryList = []
    this.entrySize = 0
  }
}

/**
 * Serializes a Realm object to a JSON-safe snapshot.
 * @returns Serialized JSON-safe object, or null.
 * @example
 * snapshot(realm, 'BeatmapSet', setUUID) // { ID: '...', OnlineID: 123, ... }
 */
export function snapshot(realm: Realm, type: string, pk: unknown): Record<string, unknown> | null {
  if (pk === undefined || pk === null) return null
  const obj = realm.objectForPrimaryKey(type, pk as never)
  if (!obj) return null
  return serialize(obj) as Record<string, unknown>
}
