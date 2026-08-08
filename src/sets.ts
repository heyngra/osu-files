import { readFileSync } from 'fs'
import Realm from 'realm'
import type { BeatmapSet } from './schema/types.js'
import { FileRef } from './types.js'
import type { OsuFilesContext } from './context.js'
import { SetQuery } from './get/sets.get.js'
import type { Sets } from './get/facades.js'
import { createCrud, type Crud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importSet as importSetFn, type ImportSetInput } from './write/set-import.js'
import type { BeatmapSetData } from './osz/types.js'
import { cleanupOrphanedFiles, cleanupBlobIfUnreferenced, getRealmFile } from './files.js'
import { sha256, fileStoragePath } from './util.js'
import { assertWritable, markChanged, writeRealm } from './context.js'
import type { OwnedFileEditor } from './skins.js'
import { computeBeatmapSetHash, normalizeFilename, validateOwnerHashes } from './integrity.js'
import { md5 } from './util.js'
import type { BeatmapSetSnapshot } from './types/readonly.js'
import { LogAction } from './write/logger.js'

function getSet(ctx: OsuFilesContext, setId: string): BeatmapSet | undefined {
  return ctx.realm.objectForPrimaryKey<BeatmapSet>('BeatmapSet', new Realm.BSON.UUID(setId)) ?? undefined
}

export type BeatmapSetEditor = {
  /** Beatmap-set UUID. */
  readonly id: string
  /** Detached beatmap-set snapshot. */
  readonly value: BeatmapSetSnapshot
  /** Opens one owner-scoped file editor. */
  getFile(filename: string): OwnedFileEditor
}

function rollbackState(set: BeatmapSet): Record<string, unknown> {
  return {
    Hash: set.Hash ?? null,
    Files: [...set.Files].map(usage => ({
      Filename: usage.Filename ?? null,
      ...(usage.File?.Hash ? { File: { Hash: usage.File.Hash } } : {}),
    })),
    Beatmaps: [...set.Beatmaps].map(beatmap => ({
      ID: String(beatmap.ID),
      Hash: beatmap.Hash ?? null,
      MD5Hash: beatmap.MD5Hash ?? null,
    })),
  }
}

/**
 * Creates the beatmap-set module with read-only results, write, import, and delete operations.
 * @example
 * const set = db.sets.get.byOnlineId(506483)[0]
 */
export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const raw = new SetQuery(ctx.realm)
  raw.enableCache = ctx.queryCache ?? true
  const get = raw.proxify()
  const write = createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!)
  return {
    get: get as unknown as Sets,
    write,
    /**
     * Opens a beatmap set for safe copy-on-write file editing.
     *
     * @param setId - Beatmap-set UUID.
     * @returns An editor whose changes update dependent hashes atomically.
     * @throws If the set does not exist, is read-only, or a file is invalid.
     * @example
     * await db.sets.open(setId).getFile('background.jpg').edit(transform)
     */
    open: (setId: string): BeatmapSetEditor => {
      const set = getSet(ctx, setId)
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      const value = { ...set, Files: [...set.Files].map(file => ({ Filename: file.Filename, File: file.File ? { Hash: file.File.Hash } : undefined })) } as unknown as Readonly<BeatmapSet>
      return {
        id: setId,
        value,
        getFile(filename: string): OwnedFileEditor {
          const normalized = normalizeFilename(filename).toLowerCase()
          const usage = [...set.Files].find(file => normalizeFilename(file.Filename ?? '').toLowerCase() === normalized)
          if (!usage?.File?.Hash) throw new Error(`BeatmapSet '${setId}' file '${filename}' not found`)
          const originalHash = usage.File.Hash
          const replace = async (content: Buffer): Promise<boolean> => {
            assertWritable(ctx)
            const before = rollbackState(set)
            const transaction = ctx.fileStore?.beginTransaction()
            const checkpoint = ctx.logger.checkpoint()
            const previousTransaction = ctx.fileTransaction
            ctx.fileTransaction = transaction
            try {
              const result = writeRealm(ctx, () => {
                const stored = transaction?.put(content) ?? ctx.fileStore?.put(content)
                if (!stored) throw new Error('File store is unavailable')
                if (stored.hash === originalHash) return false
                const file = getRealmFile(ctx, stored.hash) ?? ctx.files.write.create({ Hash: stored.hash })
                const next = [...set.Files].map(item => item === usage ? { Filename: item.Filename, File: file } : { Filename: item.Filename, File: item.File })
                const beatmap = set.Beatmaps.find(item => item.Hash === originalHash)
                if (beatmap && /\.osu$/i.test(usage.Filename ?? '')) {
                  beatmap.Hash = stored.hash
                  beatmap.MD5Hash = md5(content)
                }
                transaction?.commit()
                set.Files[set.Files.indexOf(usage)] = { File: file, Filename: usage.Filename }
                set.Hash = computeBeatmapSetHash(ctx, next)
                validateOwnerHashes(ctx, set)
                return true
              })
              transaction?.finalize()
              markChanged(ctx)
              ctx.logger.log('BeatmapSet', LogAction.Update, set.ID, before, rollbackState(set))
              cleanupBlobIfUnreferenced(ctx, originalHash)
              return result
            } catch (error) {
              try { ctx.logger.discardSince(checkpoint) } finally { transaction?.rollback() }
              throw error
            } finally { ctx.fileTransaction = previousTransaction }
          }
          const editor: OwnedFileEditor = {
            filename: usage.Filename ?? filename,
            hash: originalHash,
            read: () => {
              if (!ctx.fileStore) throw new Error('filesFolderPath is required')
              return ctx.fileStore.read(originalHash)
            },
            replace,
            edit: async transform => replace(await transform(editor.read())),
          }
          return editor
        },
      }
    },
    importSet: (data: ImportSetInput): BeatmapSetData => importSetFn(ctx, data),
    delete: (setId: string): void => {
      const set = getSet(ctx, setId)
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      write.update(set.ID, { DeletePending: true })
      cleanupOrphanedFiles(ctx)
    },

    addFile(setId: string, filename: string, content: Buffer): FileRef {
      if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
      assertWritable(ctx)
      const normalizedFilename = normalizeFilename(filename)
      const set = getSet(ctx, setId)
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      const transaction = ctx.fileStore?.beginTransaction()
      const checkpoint = ctx.logger.checkpoint()
      const previousTransaction = ctx.fileTransaction
      ctx.fileTransaction = transaction
      try {
        const hash = transaction?.put(content).hash ?? ctx.fileStore?.put(content).hash ?? sha256(content)
        writeRealm(ctx, () => {
          transaction?.commit()
          if (!getRealmFile(ctx, hash)) {
            ctx.files.write.upsert({ Hash: hash })
          }
          if (set.Files.some(file => normalizeFilename(file.Filename ?? '').toLowerCase() === normalizedFilename.toLowerCase()))
            throw new Error(`BeatmapSet '${setId}' already contains file '${normalizedFilename}'`)
          const fu = { File: getRealmFile(ctx, hash)!, Filename: normalizedFilename }
          set.Files.push(fu)
          set.Hash = computeBeatmapSetHash(ctx, set.Files)
          validateOwnerHashes(ctx, set)
          markChanged(ctx)
        })
        transaction?.finalize()
        return new FileRef(normalizedFilename, { hash, content })
      } catch (error) {
        try { ctx.logger.discardSince(checkpoint) } finally { transaction?.rollback() }
        throw error
      } finally {
        ctx.fileTransaction = previousTransaction
      }
    },

    getFileRefs(setId: string): FileRef[] {
      const set = get.byId(setId)[0]
      if (!set) return []
      return (set.Files ?? []).map(fu => new FileRef(fu.Filename ?? '', { hash: fu.File?.Hash ?? undefined }))
    },

    getFileRefsWithContent(setId: string): FileRef[] {
      if (!ctx.filesFolderPath) return this.getFileRefs(setId)
      const set = get.byId(setId)[0]
      if (!set) return []
      return (set.Files ?? []).map(fu => {
        const hash = fu.File?.Hash ?? ''
        let content: Buffer | undefined
        if (hash) {
          try { content = readFileSync(fileStoragePath(ctx.filesFolderPath!, hash)) } catch {}
        }
        return new FileRef(fu.Filename ?? '', { hash: hash || undefined, content })
      })
    },
  }
}

/** Beatmap-set module with read-only results, write, import, and delete operations. */
export type BeatmapSetUpdatePatch = Partial<Omit<BeatmapSet, 'ID' | 'Hash' | 'Files'>>
export interface BeatmapSetModule {
  /** Returns read-only beatmap-set snapshots through `get`. */
  readonly get: Sets
  /** Creates, updates, deletes, or upserts beatmap sets. */
  readonly write: Crud<BeatmapSet>
  /** Opens one beatmap-set editor. */
  open(setId: string): BeatmapSetEditor
  /** Imports beatmap-set data. */
  importSet(data: ImportSetInput): BeatmapSetData
  /** Marks a beatmap set for deletion. */
  delete(setId: string): void
  /** Adds a file and updates the set hash. */
  addFile(setId: string, filename: string, content: Buffer): FileRef
  /** Returns file references owned by the set. */
  getFileRefs(setId: string): FileRef[]
  /** Returns file references with file content when available. */
  getFileRefsWithContent(setId: string): FileRef[]
}
