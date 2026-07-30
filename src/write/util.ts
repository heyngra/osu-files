import type { OsuFilesContext } from '../context.js'
import { assertWritable, markChanged, writeRealm } from '../context.js'
import { snapshot, LogAction } from './logger.js'
import { ValidationError, required, unique, resolveRef } from './validate.js'
import { validateFileReference, normalizeFilename, computeSkinHash, computeBeatmapSetHash } from '../integrity.js'

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
  const validateHashValue = (hash: unknown, label: string): void => {
    if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new ValidationError(`${label} must be a lowercase SHA-256 hash`)
    if (ctx.filesFolderPath && !ctx.fileTransaction?.has(hash) && !ctx.fileStore?.verify(hash))
      throw new ValidationError(`${label} does not refer to a verified stored blob`)
  }
  const validateFilesPatch = (files: unknown, hash: unknown): void => {
    if (!Array.isArray(files)) throw new ValidationError(`${cfg.name}.Files must be an array`)
    const seen = new Set<string>()
    for (const usage of files as any[]) {
      const filename = normalizeFilename(String(usage?.Filename ?? ''))
      const key = filename.toLowerCase()
      if (seen.has(key)) throw new ValidationError(`${cfg.name}.Files contains duplicate filename '${filename}'`)
      seen.add(key)
      validateFileReference(ctx, usage, cfg.name)
    }
    if (hash !== undefined) {
      const expected = cfg.name === 'Skin'
        ? computeSkinHash(ctx, files as any)
        : cfg.name === 'BeatmapSet' ? computeBeatmapSetHash(ctx, files as any) : undefined
      if (expected !== undefined && hash !== expected) throw new ValidationError(`${cfg.name}.Hash does not match its file content`)
      if (cfg.name === 'Score') {
        const replay = (files as any[]).find(file => /\.osr$/i.test(String(file?.Filename ?? '')))
        if (replay?.File?.Hash !== hash) throw new ValidationError('Score.Hash must match its replay file')
      }
    }
  }
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

      if (cfg.name === 'File' && input.Hash !== undefined) validateHashValue(input.Hash, 'File.Hash')
      if ((cfg.name === 'Skin' || cfg.name === 'BeatmapSet' || cfg.name === 'Score') && input.Files !== undefined)
        validateFilesPatch(input.Files, input.Hash)
      if (cfg.name === 'Beatmap' && input.Hash !== undefined) validateHashValue(input.Hash, 'Beatmap.Hash')

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

      if (cfg.name === 'File' && patch.Hash !== undefined)
        throw new ValidationError('File.Hash is immutable; use db.files.put() and an owner editor')
      if ((cfg.name === 'Skin' || cfg.name === 'BeatmapSet' || cfg.name === 'Score') && patch.Files !== undefined)
        throw new ValidationError(`${cfg.name}.Files is protected; use its owner editor`)
      if (cfg.name === 'Skin' || cfg.name === 'BeatmapSet') {
        if (patch.Hash !== undefined) {
          const expected = cfg.name === 'Skin' ? computeSkinHash(ctx, (existing as any).Files) : computeBeatmapSetHash(ctx, (existing as any).Files)
          if (patch.Hash !== expected) throw new ValidationError(`${cfg.name}.Hash is derived from its files and cannot be assigned directly`)
        }
      }
      if (cfg.name === 'Beatmap' && patch.Hash !== undefined) validateHashValue(patch.Hash, 'Beatmap.Hash')

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
