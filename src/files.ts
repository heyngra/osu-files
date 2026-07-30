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

export type FileCleanupReport = {
  candidates: number
  removed: number
  missing: number
  failed: Array<{ hash: string; error: unknown }>
}

/**
 * Deletes file records and storage files no longer referenced by any set, skin, or score.
 * @returns Counts of candidates, removed files, missing files, and failures.
 * @throws If no writable database is available.
 * @example
 * db.files.cleanupOrphanedFiles()
 */
export function cleanupOrphanedFiles(ctx: OsuFilesContext): FileCleanupReport {
  const report: FileCleanupReport = { candidates: 0, removed: 0, missing: 0, failed: [] }
  if (!ctx.filesFolderPath) return report
  assertWritable(ctx)

  const fileSchema = ctx.realm.schema.find(schema => schema.name === 'File')
  const hasBacklinks = !!fileSchema && 'Usages' in fileSchema.properties
  const orphaned = hasBacklinks
    ? [...ctx.realm.objects<any>('File').filtered('Usages.@count == 0')]
    : findOrphanedFilesByScan(ctx)
  report.candidates = orphaned.length
  if (orphaned.length === 0) return report

  writeRealm(ctx, () => {
    for (const file of orphaned) ctx.realm.delete(file)
  })

  for (const file of orphaned) {
    try {
      if (ctx.fileStore?.remove(file.Hash!)) report.removed++
      else report.missing++
    } catch (error) {
      report.failed.push({ hash: file.Hash!, error })
    }
  }
  markChanged(ctx)
  return report
}

function findOrphanedFilesByScan(ctx: OsuFilesContext): any[] {
  const referenced = new Set<string>()
  for (const src of [ctx.sets.get, ctx.skins.get, ctx.scores.get]) {
    for (const s of src) {
      if (s.DeletePending) continue
      for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
    }
  }
  return ctx.files.get.filter(f => f.Hash && !referenced.has(f.Hash))
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
