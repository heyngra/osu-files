import Realm from 'realm'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type { BeatmapSet } from './schema/types.js'
import type { FileRef } from './types.js'
import type { OsuFilesContext } from './context.js'
import { SetQuery } from './get/sets.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { importSet as importSetFn, type ImportSetInput } from './write/set-import.js'
import type { BeatmapSetData } from './osz/types.js'
import { cleanupOrphanedFiles } from './files.js'
import { sha256, fileStoragePath, ensureParentDir } from './util.js'

/**
 * Creates the beatmap set sub-module with query, write, import, and delete operations.
 * @example
 * const set = db.sets.get.byOnlineIdExact(506483)[0]
 */
export function createBeatmapSetModule(ctx: OsuFilesContext) {
  const raw = new SetQuery(ctx.realm)
  raw.enableCache = ctx.queryCache ?? true
  const get = raw.proxify()
  const write = createCrud<BeatmapSet>(ctx, getConfig('BeatmapSet')!)
  return {
    get,
    write,
    importSet: (data: ImportSetInput): BeatmapSetData => importSetFn(ctx, data),
    delete: (setId: string): void => {
      const set = get.byId(setId)[0]
      if (!set) throw new Error(`BeatmapSet '${setId}' not found`)
      write.update(set.ID, { DeletePending: true })
      cleanupOrphanedFiles(ctx)
    },

    addFile(setId: string, filename: string, content: Buffer): FileRef {
      if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required')
      const hash = sha256(content)
      const storePath = fileStoragePath(ctx.filesFolderPath, hash)
      if (!existsSync(storePath)) {
        ensureParentDir(storePath)
        writeFileSync(storePath, content)
      }
      if (!ctx.files.get.byHashEquals(hash)[0]) {
        ctx.files.write.upsert({ Hash: hash })
      }
      const set = get.byId(setId)[0]
      if (set) {
        const fu = { File: ctx.files.get.byHashEquals(hash)[0]!, Filename: filename }
        ctx.realm.write(() => { (set.Files as any[]).push(fu) })
      }
      return { filename, hash, content }
    },

    getFileRefs(setId: string): FileRef[] {
      const set = get.byId(setId)[0]
      if (!set) return []
      return (set.Files ?? []).map(fu => ({
        filename: fu.Filename ?? '',
        hash: fu.File?.Hash ?? undefined,
      }))
    },

    getFileRefsWithContent(setId: string): FileRef[] {
      if (!ctx.filesFolderPath) return this.getFileRefs(setId)
      const set = get.byId(setId)[0]
      if (!set) return []
      return (set.Files ?? []).map(fu => {
        const hash = fu.File?.Hash ?? ''
        const ref: FileRef = { filename: fu.Filename ?? '', hash: hash || undefined }
        if (hash) {
          try { ref.content = readFileSync(fileStoragePath(ctx.filesFolderPath!, hash)) } catch {}
        }
        return ref
      })
    },
  }
}

/** Beatmap set sub-module with query, write, import, and delete operations. */
export type BeatmapSetModule = ReturnType<typeof createBeatmapSetModule>
