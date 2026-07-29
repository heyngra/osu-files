import type { OsuFilesContext } from '../context.js'
import { assertWritable, markChanged, writeRealm } from '../context.js'
import { snapshot, LogAction } from './logger.js'
import { ValidationError, required, unique, resolveRef } from './validate.js'

export type DeleteGuard = {
  /** Realm type name to check for backlinks. */
  type: string
  /**
   * Realm filtered() predicate using `$0` for the entity PK value.
   * @example 'BeatmapInfo.ID == $0'
   */
  filter: string
  label: string
}

/** Configuration that drives CRUD operations for a single Realm entity type. */
export type EntityConfig = {
  /** Realm schema type name. @example 'Beatmap' */
  name: string
  /** Primary key field name. @example 'ID' | 'ShortName' | 'Hash' */
  pk: string
  pkOptional?: boolean
  required?: string[]
  /**
   * Foreign key resolvers: field -> Realm type name.
   * Values can be a PK string/number or the object itself.
   * @example { Ruleset: 'Ruleset', BeatmapSet: 'BeatmapSet' }
   */
  fks?: Record<string, string>
  /** Fields to remove from input before passing to Realm.create(). */
  strip?: string[]
  /** Defaults supplied for required primitive properties. */
  defaults?: Record<string, unknown>
  /** Backlink checks run before delete. Delete throws if any match. */
  guards?: DeleteGuard[]
}

/**
 * Creates a {@link create | CRUD} helper for a Realm entity type.
 *
 * @example
 * createCrud<Beatmap>(ctx, {
 *   name: 'Beatmap', pk: 'ID',
 *   required: ['ID', 'Status', 'OnlineID'],
 *   fks: { Ruleset: 'Ruleset', BeatmapSet: 'BeatmapSet' },
 *   guards: [{ type: 'Score', filter: 'BeatmapInfo.ID == $0', label: 'Score' }],
 * })
 */
export function createCrud<T>(ctx: OsuFilesContext, cfg: EntityConfig) {
  return {
    create(input: Record<string, unknown>): T {
      assertWritable(ctx)
      for (const f of cfg.required ?? [])
        required(input[f], `${cfg.name}.${f}`)
      if (!cfg.pkOptional && input[cfg.pk] !== undefined && input[cfg.pk] !== null)
        unique(ctx.realm, cfg.name, cfg.pk, input[cfg.pk])

      const data: Record<string, unknown> = { ...input }
      for (const [field, value] of Object.entries(cfg.defaults ?? {}))
        if (data[field] === undefined) data[field] = value
      for (const f of cfg.strip ?? []) delete data[f]
      for (const [field, type] of Object.entries(cfg.fks ?? {}))
        if (field in input) data[field] = resolveRef(ctx.realm, type, input[field] as never)

      if (ctx.checkHash && !ctx.filesFolderPath) throw new ValidationError(`Can't verify hash, no files folder set.`)
      
      if (ctx.checkHash && ctx.filesFolderPath && input.Hash) {
        if (!ctx.fileStore?.verify(input.Hash as string) && !ctx.fileTransaction?.has(input.Hash as string))
          throw new ValidationError(`File not found or invalid: ${input.Hash}`)
      }

      let created: T
      writeRealm(ctx, () => { created = ctx.realm.create<T>(cfg.name, data as never) })
      markChanged(ctx)
      ctx.logger.log(cfg.name, LogAction.Create, String(input[cfg.pk] ?? '(nil)'), null, created!)
      return created!
    },

    /** Update an existing entity by PK. */
    update(id: unknown, patch: Record<string, unknown>): T {
      assertWritable(ctx)
      const existing = ctx.realm.objectForPrimaryKey<T>(cfg.name, id as never)
      if (!existing) throw new ValidationError(`${cfg.name} '${id}' not found`)

      const before = snapshot(ctx.realm, cfg.name, id)
      const data: Record<string, unknown> = { ...patch }
      for (const f of cfg.strip ?? []) delete data[f]
      for (const [field, type] of Object.entries(cfg.fks ?? {}))
        if (field in patch) data[field] = resolveRef(ctx.realm, type, patch[field] as never)

      if (ctx.checkHash && ctx.filesFolderPath && patch.Hash) {
        if (!ctx.fileStore?.verify(patch.Hash as string) && !ctx.fileTransaction?.has(patch.Hash as string))
          throw new ValidationError(`File not found or invalid: ${patch.Hash}`)
      }

      writeRealm(ctx, () => {
        for (const key of Object.keys(data)) {
          if (key === cfg.pk) continue
          ;(existing as any)[key] = data[key]
        }
      })
      markChanged(ctx)
      ctx.logger.log(cfg.name, LogAction.Update, id, before, snapshot(ctx.realm, cfg.name, id))
      return existing
    },

    delete(id: unknown): boolean {
      assertWritable(ctx)
      const existing = ctx.realm.objectForPrimaryKey<T>(cfg.name, id as never)
      if (!existing) return false

      for (const guard of cfg.guards ?? []) {
        const refs = ctx.realm.objects(guard.type).filtered(guard.filter, id)
        if (refs.length > 0)
          throw new ValidationError(`Cannot delete ${cfg.name} '${id}': ${refs.length} ${guard.label}(s) reference it`)
      }

      const before = snapshot(ctx.realm, cfg.name, id)
      writeRealm(ctx, () => { ctx.realm.delete(existing as never) })
      markChanged(ctx)
      ctx.logger.log(cfg.name, LogAction.Delete, id, before, null)
      return true
    },

    /** Create if the PK doesn't exist, update if it does. */
    upsert(input: Record<string, unknown>): T {
      const pkVal = input[cfg.pk]
      if (pkVal === undefined || pkVal === null) return this.create(input)
      const existing = ctx.realm.objectForPrimaryKey<T>(cfg.name, pkVal as never)
      if (existing) return this.update(pkVal, input)
      return this.create(input)
    },
  }
}
