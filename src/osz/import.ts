import { createHash } from 'crypto'
import { createWriteStream, closeSync, fsyncSync, openSync, readFileSync, rmSync } from 'fs'
import { open as openZip } from 'yauzl'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from '../beatmap/parse.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from './types.js'
import { importSet } from '../write/set-import.js'
import { sha256, md5, normalizeFilename, detectCommonPrefix, stripPrefix, temporaryFilePath } from '../util.js'
import { assertWritable, writeRealm } from '../context.js'

/** A single entry read from a zip archive. */
export type ZipEntry = { filename: string; buffer: Buffer }

/** A ZIP entry streamed to a temporary file while hashing. */
export type StreamedZipEntry = { filename: string; path: string; size: number; hash: string }

/** Limits applied while reading an archive. */
export type ArchiveLimits = {
  maxEntries?: number
  maxEntryBytes?: number
  maxTotalBytes?: number
  maxCompressionRatio?: number
}

const DEFAULT_ARCHIVE_LIMITS: Required<ArchiveLimits> = {
  maxEntries: 10_000,
  maxEntryBytes: 256 * 1024 * 1024,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxCompressionRatio: 100,
}

function validateArchiveLimits(limits: Required<ArchiveLimits>): void {
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0)
      throw new Error(`[osu-files] archive limit '${name}' must be a positive safe integer`)
  }
}

/**
 * Reads all entries from a zip file.
 * @returns Array of zip entries with filename and buffer.
 * @example
 * readZipEntries('/path/to/file.osz') // [{ filename: 'song.osu', buffer: <Buffer> }]
 */
export function readZipEntries(filePath: string, limits?: ArchiveLimits): Promise<ZipEntry[]> {
  const options = { ...DEFAULT_ARCHIVE_LIMITS, ...limits }
  validateArchiveLimits(options)
  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = []
    const filenames = new Set<string>()
    let totalBytes = 0
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      reject(error)
    }
    const finish = (): void => {
      if (settled) return
      settled = true
      resolve(entries)
    }
    openZip(filePath, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
      if (err) return fail(err)
      if (!zipfile) return fail(new Error('Failed to open zip'))
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (settled) return
        if (/\/$/.test(entry.fileName)) { zipfile.readEntry(); return }
        if (entries.length >= options.maxEntries) {
          fail(new Error(`Archive contains more than ${options.maxEntries} files`))
          zipfile.close()
          return
        }
        if (entry.uncompressedSize > options.maxEntryBytes) {
          fail(new Error(`Archive entry is larger than ${options.maxEntryBytes} bytes`))
          zipfile.close()
          return
        }
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > options.maxCompressionRatio) {
          fail(new Error(`Archive entry compression ratio exceeds ${options.maxCompressionRatio}`))
          zipfile.close()
          return
        }
        let filename: string
        try {
          filename = safeArchiveFilename(entry.fileName)
        } catch (error) {
          zipfile.close()
          fail(error as Error)
          return
        }
        const filenameKey = filename.toLowerCase()
        if (filenames.has(filenameKey)) {
          fail(new Error(`Archive contains duplicate filename: ${filename}`))
          zipfile.close()
          return
        }
        filenames.add(filenameKey)
        const chunks: Buffer[] = []
        let entryBytes = 0
        zipfile.openReadStream(entry, (err2, rs) => {
          if (err2) return fail(err2)
          if (!rs) return fail(new Error('No read stream'))
          rs.on('data', (chunk: Buffer) => {
            entryBytes += chunk.length
            totalBytes += chunk.length
            if (entryBytes > options.maxEntryBytes || totalBytes > options.maxTotalBytes) {
              rs.destroy(new Error('Archive exceeds configured size limits'))
              return
            }
            chunks.push(chunk)
          })
          rs.on('end', () => {
            if (settled) return
            entries.push({ filename, buffer: Buffer.concat(chunks) })
            zipfile.readEntry()
          })
          rs.on('error', fail)
        })
      })
      zipfile.on('end', finish)
      zipfile.on('error', fail)
    })
  })
}

/**
 * Streams ZIP entries to temporary files without retaining decompressed content in memory.
 * Temporary files are owned by the caller and must be promoted or removed.
 *
 * @param filePath - Archive to read.
 * @param limits - Entry, total-size, and compression-ratio limits.
 * @returns Streamed entries with their temporary path and SHA-256 hash.
 */
export function readZipEntriesToFiles(filePath: string, limits?: ArchiveLimits): Promise<StreamedZipEntry[]> {
  const options = { ...DEFAULT_ARCHIVE_LIMITS, ...limits }
  validateArchiveLimits(options)
  return new Promise((resolve, reject) => {
    const entries: StreamedZipEntry[] = []
    const filenames = new Set<string>()
    const temporaryPaths: string[] = []
    let totalBytes = 0
    let settled = false

    const cleanup = (): void => {
      for (const path of temporaryPaths) rmSync(path, { force: true })
    }
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }
    const finish = (): void => {
      if (settled) return
      settled = true
      resolve(entries)
    }

    openZip(filePath, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
      if (err) return fail(err)
      if (!zipfile) return fail(new Error('Failed to open zip'))
      zipfile.readEntry()
      zipfile.on('entry', entry => {
        if (settled) return
        if (/\/$/.test(entry.fileName)) { zipfile.readEntry(); return }
        if (entries.length >= options.maxEntries) {
          fail(new Error(`Archive contains more than ${options.maxEntries} files`))
          zipfile.close()
          return
        }
        if (entry.uncompressedSize > options.maxEntryBytes || totalBytes + entry.uncompressedSize > options.maxTotalBytes) {
          fail(new Error(`Archive exceeds configured size limits at '${entry.fileName}'`))
          zipfile.close()
          return
        }
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > options.maxCompressionRatio) {
          fail(new Error(`Archive entry compression ratio exceeds ${options.maxCompressionRatio}`))
          zipfile.close()
          return
        }

        let filename: string
        try { filename = safeArchiveFilename(entry.fileName) } catch (error) {
          fail(error as Error)
          zipfile.close()
          return
        }
        const filenameKey = filename.toLowerCase()
        if (filenames.has(filenameKey)) {
          fail(new Error(`Archive contains duplicate filename: ${filename}`))
          zipfile.close()
          return
        }
        filenames.add(filenameKey)

        zipfile.openReadStream(entry, (streamError, rs) => {
          if (streamError) return fail(streamError)
          if (!rs) return fail(new Error('No read stream'))
          const path = temporaryFilePath('archive-entry')
          temporaryPaths.push(path)
          const output = createWriteStream(path, { flags: 'wx' })
          const digest = createHash('sha256')
          let size = 0
          let complete = false
          const abort = (error: Error): void => {
            if (complete) return
            complete = true
            rs.destroy()
            output.destroy()
            fail(error)
          }
          rs.on('data', (chunk: Buffer) => {
            size += chunk.length
            totalBytes += chunk.length
            if (size > options.maxEntryBytes || totalBytes > options.maxTotalBytes) {
              abort(new Error(`Archive exceeds configured size limits at '${filename}'`))
              return
            }
            digest.update(chunk)
            if (!output.write(chunk)) rs.pause()
          })
          output.on('drain', () => rs.resume())
          output.on('error', abort)
          rs.on('error', abort)
          rs.on('end', () => {
            if (complete) return
            output.end(() => {
              try {
                const handle = openSync(path, 'r+')
                try { fsyncSync(handle) } finally { closeSync(handle) }
                complete = true
                entries.push({ filename, path, size, hash: digest.digest('hex') })
                zipfile.readEntry()
              } catch (error) { abort(error as Error) }
            })
          })
        })
      })
      zipfile.on('end', finish)
      zipfile.on('error', fail)
    })
  })
}

function safeArchiveFilename(filename: string): string {
  const normalized = normalizeFilename(filename)
  if (!normalized || normalized.includes('\0') || normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized))
    throw new Error(`Unsafe archive filename: ${filename}`)
  if (Buffer.byteLength(normalized, 'utf8') > 4096)
    throw new Error(`Archive filename is too long: ${filename}`)
  const parts = normalized.split('/')
  if (parts.some(part => part === '..' || part === '.'))
    throw new Error(`Unsafe archive filename: ${filename}`)
  return normalized
}

function computeSetHash(osuFiles: { filename: string; content: Buffer }[]): string {
  const sorted = [...osuFiles].sort((a, b) => a.filename.localeCompare(b.filename))
  return sha256(Buffer.concat(sorted.map(f => f.content)))
}

type ProcessedEntry = { filename: string; buffer: Buffer; hash: string }
type OsuEntry = { filename: string; buffer: Buffer; hash: string; md5Hash: string; beatmap: OsuBeatmap }

/**
 * Imports an .osz archive into the Realm database.
 * @returns Imported beatmap set data.
 * @throws If filesFolderPath is missing or archive is empty.
 * @example
 * importOsz(ctx, '/path/to/beatmap.osz') // BeatmapSetData
 */
export async function importOsz(ctx: OsuFilesContext, filePath: string): Promise<BeatmapSetData> {
  if (!ctx.filesFolderPath) throw new Error('filesFolderPath is required for import')
  assertWritable(ctx)

  const entries = await readZipEntriesToFiles(filePath, ctx.archiveLimits)
  if (entries.length === 0) throw new Error('Empty archive')

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const normalized = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    path: e.path,
    hash: e.hash,
  }))

  const osuEntries: OsuEntry[] = []
  for (const entry of normalized) {
    if (entry.filename.toLowerCase().endsWith('.osu')) {
      const buffer = readFileSync(entry.path)
      const beatmap = parseOsu(buffer.toString('utf-8'))
      beatmap.metadata.beatmapID = beatmap.metadata.beatmapID ?? -1
      beatmap.metadata.beatmapSetID = beatmap.metadata.beatmapSetID ?? -1
      osuEntries.push({
        filename: entry.filename,
        buffer,
        hash: entry.hash,
        md5Hash: md5(buffer),
        beatmap,
      })
    }
  }
  if (osuEntries.length === 0) {
    for (const entry of entries) rmSync(entry.path, { force: true })
    throw new Error('Archive contains no .osu beatmaps')
  }

  const setHash = computeSetHash(osuEntries.map(e => ({ filename: e.filename, content: e.buffer })))
  const firstMeta = osuEntries[0]?.beatmap.metadata
  const onlineID = (firstMeta?.beatmapSetID ?? -1) > 0 ? firstMeta!.beatmapSetID : -1
  const fileTransaction = ctx.fileStore?.beginTransaction()
  const checkpoint = ctx.logger.checkpoint()
  const previousTransaction = ctx.fileTransaction
  ctx.fileTransaction = fileTransaction

  try {
    const result = writeRealm(ctx, () => {
      for (const entry of normalized) fileTransaction?.putFile(entry.path, entry.hash)
      fileTransaction?.commit()
      return importSet(ctx, {
        onlineID,
        setHash,
        status: 0,
        protected: false,
        files: normalized.map(e => ({ hash: e.hash, filename: e.filename })),
        beatmaps: osuEntries.map(e => ({
          filename: e.filename,
          hash: e.hash,
          md5Hash: e.md5Hash,
          osuBeatmap: e.beatmap,
        })),
      })
    })
    fileTransaction?.finalize()
    return result
  } catch (error) {
    try { ctx.logger.discardSince(checkpoint) } finally { fileTransaction?.rollback() }
    throw error
  } finally {
    for (const entry of entries) rmSync(entry.path, { force: true })
    ctx.fileTransaction = previousTransaction
  }
}
