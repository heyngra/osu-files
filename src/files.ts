import { readFileSync, rmSync } from 'fs'
import type { File } from './schema/types.js'
import type { FileRef } from './types.js'
import type { OsuFilesContext } from './context.js'
import { FileQuery } from './get/files.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { fileStoragePath } from './util.js'

/**
 * Deletes file records and storage files no longer referenced by any set, skin, or score.
 * @example
 * db.files.cleanupOrphanedFiles()
 */
export function cleanupOrphanedFiles(ctx: OsuFilesContext): void {
  if (!ctx.filesFolderPath) return

  const referenced = new Set<string>()

  for (const src of [ctx.sets.get, ctx.skins.get, ctx.scores.get]) {
    for (const s of src) {
      if (s.DeletePending) continue
      for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
    }
  }

  const orphaned = ctx.files.get.filter(f => f.Hash && !referenced.has(f.Hash))
  if (orphaned.length === 0) return

  ctx.realm.write(() => {
    for (const file of orphaned) {
      try { rmSync(fileStoragePath(ctx.filesFolderPath!, file.Hash!)) } catch { }
      ctx.realm.delete(file)
    }
  })
}

/**
 * Creates the file sub-module with query, write, and orphan cleanup operations.
 * @example
 * const f = db.files.get.byHashEquals(hash)[0]
 */
export function createFileModule(ctx: OsuFilesContext) {
  const fileQuery = new FileQuery(ctx.realm)
  fileQuery.enableCache = ctx.queryCache ?? true
  const get = fileQuery.proxify()
  return {
    get,
    write: createCrud<File>(ctx, getConfig('File')!),
    cleanupOrphanedFiles: () => cleanupOrphanedFiles(ctx),

    fileRef(hash: string, filename: string): FileRef {
      return { filename, hash }
    },

    fileRefWithContent(hash: string, filename: string): FileRef {
      const ref: FileRef = { filename, hash }
      if (ctx.filesFolderPath) {
        const p = fileStoragePath(ctx.filesFolderPath, hash)
        try { ref.content = readFileSync(p) } catch {}
      }
      return ref
    },
  }
}

/** File sub-module with query, write, and orphan cleanup operations. */
export type FileModule = ReturnType<typeof createFileModule>
