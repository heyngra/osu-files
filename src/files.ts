import { readFileSync } from 'fs'
import type { File, RealmFile } from './schema/types.js'
import { FileRef } from './types.js'
import type { OsuFilesContext } from './context.js'
import { FileQuery } from './get/files.get.js'
import type { Files } from './get/facades.js'
import { createCrud, type Crud } from './write/util.js'
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

/** Returns a live File object for internal compound transactions. */
export function getRealmFile(ctx: OsuFilesContext, hash: string): RealmFile | undefined {
  return ctx.realm.objectForPrimaryKey<RealmFile>('File', hash) ?? undefined
}

/** Removes one replaced blob only when no owner still references it. */
export function cleanupBlobIfUnreferenced(ctx: OsuFilesContext, hash: string): void {
  if (!ctx.fileStore) return
  for (const type of ['Skin', 'BeatmapSet', 'Score']) {
    for (const owner of ctx.realm.objects<{ Files?: Iterable<{ File?: { Hash?: string } }> }>(type)) {
      if ([...(owner.Files ?? [])].some(usage => usage.File?.Hash === hash)) return
    }
  }
  if (hasRollbackReference(ctx, hash)) return

  const removed = ctx.fileStore.remove(hash)
  const file = getRealmFile(ctx, hash)
  if (file && (removed || !ctx.fileStore.hasPath(hash)))
    writeRealm(ctx, () => {
      const live = getRealmFile(ctx, hash)
      if (live) ctx.realm.delete(live)
    })
}

/**
 * Deletes file records and storage files no longer referenced by a set, skin, or score.
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
    ? [...ctx.realm.objects<RealmFile>('File').filtered('Usages.@count == 0')]
    : findOrphanedFilesByScan(ctx)
  report.candidates = orphaned.length
  if (orphaned.length === 0) return report

  for (const candidate of orphaned) {
    const hash = candidate.Hash as string
    try {
      const live = getRealmFile(ctx, hash)
      if (!live || hasLiveReference(ctx, hash) || hasRollbackReference(ctx, hash)) continue

      if (ctx.fileStore?.remove(hash)) report.removed++
      else report.missing++

      // Remove metadata only after storage deletion succeeds (or confirms the
      // blob was already missing), so a transient storage failure is retryable.
      const current = getRealmFile(ctx, hash)
      if (current) writeRealm(ctx, () => {
        const latest = getRealmFile(ctx, hash)
        if (latest) ctx.realm.delete(latest)
      })
    } catch (error) {
      report.failed.push({ hash, error })
    }
  }
  markChanged(ctx)
  return report
}

function findOrphanedFilesByScan(ctx: OsuFilesContext): RealmFile[] {
  const referenced = new Set<string>()
  for (const src of [ctx.sets.get, ctx.skins.get, ctx.scores.get]) {
    for (const s of src) {
      if (s.DeletePending) continue
      for (const u of s.Files) if (u.File?.Hash) referenced.add(u.File.Hash)
    }
  }
  return ctx.files.get
    .filter(f => f.Hash && !referenced.has(f.Hash))
    .map(f => getRealmFile(ctx, f.Hash!))
    .filter((file): file is RealmFile => !!file)
}

function hasLiveReference(ctx: OsuFilesContext, hash: string): boolean {
  for (const type of ['Skin', 'BeatmapSet', 'Score']) {
    for (const owner of ctx.realm.objects<{ Files?: Iterable<{ File?: { Hash?: string } }> }>(type)) {
      if ([...(owner.Files ?? [])].some(usage => usage.File?.Hash === hash)) return true
    }
  }
  return false
}

function hasRollbackReference(ctx: OsuFilesContext, hash: string): boolean {
  return ctx.logger.entries.some(entry =>
    (entry.entity === 'Skin' || entry.entity === 'BeatmapSet' || entry.entity === 'Score')
    && containsValue(entry.before, hash))
}

function containsValue(value: unknown, needle: string): boolean {
  if (value === needle) return true
  if (Array.isArray(value)) return value.some(item => containsValue(item, needle))
  if (value && typeof value === 'object')
    return Object.values(value as Record<string, unknown>).some(item => containsValue(item, needle))
  return false
}

/**
 * Creates the file module with read-only results, write operations, and orphan cleanup.
 * @example
 * const f = db.files.get.byHash(hash)[0]
 */
export function createFileModule(ctx: OsuFilesContext) {
  const fileQuery = new FileQuery(ctx.realm)
  fileQuery.enableCache = ctx.queryCache ?? true
  const get = fileQuery.proxify()
  return {
    get: get as unknown as Files,
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
      let content: Buffer | undefined
      if (ctx.filesFolderPath) {
        try { content = ctx.fileStore?.read(hash, false) ?? readFileSync(fileStoragePath(ctx.filesFolderPath, hash)) } catch {}
      }
      return new FileRef(filename, { hash, content })
    },
  }
}

/** File module with read-only results, write operations, and orphan cleanup. */
export type FileUpdatePatch = never
export interface FileModule {
  /** Returns read-only file snapshots through `get`. */
  readonly get: Files
  /** Stores files in the content-addressed store. */
  readonly store?: FileStore
  /** Stores a file and returns its hash. */
  put(content: Buffer, expectedHash?: string): { hash: string; created: boolean }
  /** Reads a stored file. */
  read(hash: string, verify?: boolean): Buffer
  /** Checks a stored file. */
  verify(hash: string): boolean
  /** File records cannot be updated. */
  readonly write: Crud<File>
  /** Deletes unreferenced files. */
  cleanupOrphanedFiles(): FileCleanupReport
  /** Creates a file reference. */
  fileRef(hash: string, filename: string): FileRef
  /** Creates a file reference with local content when available. */
  fileRefWithContent(hash: string, filename: string): FileRef
}
