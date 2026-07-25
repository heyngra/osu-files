import { rmSync } from 'fs'
import type { File } from './schema/types.js'
import type { OsuFilesContext } from './context.js'
import { createFileGetModule } from './get/files.get.js'
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

  for (const s of ctx.sets.get.all()) {
    if (s.DeletePending) continue
    for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
  }
  for (const s of ctx.skins.get.all()) {
    if (s.DeletePending) continue
    for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
  }
  for (const s of ctx.scores.get.all()) {
    if (s.DeletePending) continue
    for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
  }

  const orphaned = ctx.files.get.all().filter(f => f.Hash && !referenced.has(f.Hash))
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
 * const f = db.files.get.byHash(hash)
 */
export function createFileModule(ctx: OsuFilesContext) {
  const get = createFileGetModule(ctx.realm)
  return {
    get,
    write: createCrud<File>(ctx, getConfig('File')!),
    cleanupOrphanedFiles: () => cleanupOrphanedFiles(ctx),
  }
}

/** File sub-module with query, write, and orphan cleanup operations. */
export type FileModule = ReturnType<typeof createFileModule>
