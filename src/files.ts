import { readFileSync } from 'fs'
import type { File } from './schema/types.js'
import type { FileRef } from './types.js'
import type { OsuFilesContext } from './context.js'
import { FileQuery } from './get/files.get.js'
import { createCrud } from './write/util.js'
import { getConfig } from './write/factory.js'
import { fileStoragePath } from './util.js'
import { assertWritable, markChanged, writeRealm } from './context.js'
import type { FileStore } from './file-store.js'

/**
 * Deletes file records and storage files no longer referenced by any set, skin, or score.
 * @example
 * db.files.cleanupOrphanedFiles()
 */
export function cleanupOrphanedFiles(ctx: OsuFilesContext): void {
  if (!ctx.filesFolderPath) return
  assertWritable(ctx)

  const referenced = new Set<string>()

  for (const src of [ctx.sets.get, ctx.skins.get, ctx.scores.get]) {
    for (const s of src) {
      if (s.DeletePending) continue
      for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
    }
  }

  const orphaned = ctx.files.get.filter(f => f.Hash && !referenced.has(f.Hash))
  if (orphaned.length === 0) return

  writeRealm(ctx, () => {
    for (const file of orphaned) ctx.realm.delete(file)
  })

  for (const file of orphaned) {
    try { ctx.fileStore?.remove(file.Hash!) } catch { }
  }
  markChanged(ctx)
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
    store: ctx.fileStore,
    /** Stores a verified content-addressed file.
     * @example
     * const { hash } = db.files.put(Buffer.from('data'))
     */
    put(content: Buffer, expectedHash?: string) {
      if (!ctx.fileStore) throw new Error('filesFolderPath is required')
      assertWritable(ctx)
      return ctx.fileStore.put(content, expectedHash)
    },
    /** Reads and verifies a content-addressed file.
     * @example
     * const content = db.files.read(hash)
     */
    read(hash: string, verify = true): Buffer {
      if (!ctx.fileStore) throw new Error('filesFolderPath is required')
      return ctx.fileStore.read(hash, verify)
    },
    /** Checks whether a content-addressed file exists and is valid.
     * @example
     * db.files.verify(hash)
     */
    verify(hash: string): boolean {
      return !!ctx.fileStore?.verify(hash)
    },
    write: createCrud<File>(ctx, getConfig('File')!),
    cleanupOrphanedFiles: () => cleanupOrphanedFiles(ctx),

    fileRef(hash: string, filename: string): FileRef {
      return { filename, hash }
    },

    fileRefWithContent(hash: string, filename: string): FileRef {
      const ref: FileRef = { filename, hash }
      if (ctx.filesFolderPath) {
        try { ref.content = ctx.fileStore?.read(hash, false) ?? readFileSync(fileStoragePath(ctx.filesFolderPath, hash)) } catch {}
      }
      return ref
    },
  }
}

/** File sub-module with query, write, and orphan cleanup operations. */
export type FileModule = ReturnType<typeof createFileModule> & { store?: FileStore }
