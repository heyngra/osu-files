import { open as openZip } from 'yauzl'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from '../beatmap/parse.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from './types.js'
import { importSet } from '../write/set-import.js'
import { sha256, md5, normalizeFilename, detectCommonPrefix, stripPrefix } from '../util.js'
import { assertWritable, writeRealm } from '../context.js'

/** A single entry read from a zip archive. */
export type ZipEntry = { filename: string; buffer: Buffer }

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

/**
 * Reads all entries from a zip file.
 * @returns Array of zip entries with filename and buffer.
 * @example
 * readZipEntries('/path/to/file.osz') // [{ filename: 'song.osu', buffer: <Buffer> }]
 */
export function readZipEntries(filePath: string, limits?: ArchiveLimits): Promise<ZipEntry[]> {
  const options = { ...DEFAULT_ARCHIVE_LIMITS, ...limits }
  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = []
    let totalBytes = 0
    openZip(filePath, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
      if (err) return reject(err)
      if (!zipfile) return reject(new Error('Failed to open zip'))
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) { zipfile.readEntry(); return }
        if (entries.length >= options.maxEntries) {
          reject(new Error(`Archive contains more than ${options.maxEntries} files`))
          zipfile.close()
          return
        }
        if (entry.uncompressedSize > options.maxEntryBytes) {
          reject(new Error(`Archive entry is larger than ${options.maxEntryBytes} bytes`))
          zipfile.close()
          return
        }
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > options.maxCompressionRatio) {
          reject(new Error(`Archive entry compression ratio exceeds ${options.maxCompressionRatio}`))
          zipfile.close()
          return
        }
        let filename: string
        try {
          filename = safeArchiveFilename(entry.fileName)
        } catch (error) {
          zipfile.close()
          reject(error)
          return
        }
        if (entries.some(existing => existing.filename.toLowerCase() === filename.toLowerCase())) {
          reject(new Error(`Archive contains duplicate filename: ${filename}`))
          zipfile.close()
          return
        }
        const chunks: Buffer[] = []
        let entryBytes = 0
        zipfile.openReadStream(entry, (err2, rs) => {
          if (err2) return reject(err2)
          if (!rs) return reject(new Error('No read stream'))
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
            entries.push({ filename, buffer: Buffer.concat(chunks) })
            zipfile.readEntry()
          })
          rs.on('error', reject)
        })
      })
      zipfile.on('end', () => resolve(entries))
      zipfile.on('error', reject)
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

  const entries = await readZipEntries(filePath, ctx.archiveLimits)
  if (entries.length === 0) throw new Error('Empty archive')

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const normalized: ProcessedEntry[] = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    buffer: e.buffer,
    hash: sha256(e.buffer),
  }))

  const osuEntries: OsuEntry[] = []
  for (const entry of normalized) {
    if (entry.filename.toLowerCase().endsWith('.osu')) {
    const beatmap = parseOsu(entry.buffer.toString('utf-8'))
      beatmap.metadata.beatmapID = beatmap.metadata.beatmapID ?? -1
      beatmap.metadata.beatmapSetID = beatmap.metadata.beatmapSetID ?? -1
      osuEntries.push({
        filename: entry.filename,
        buffer: entry.buffer,
        hash: entry.hash,
        md5Hash: md5(entry.buffer),
        beatmap,
      })
    }
  }
  if (osuEntries.length === 0) throw new Error('Archive contains no .osu beatmaps')

  const setHash = computeSetHash(osuEntries.map(e => ({ filename: e.filename, content: e.buffer })))
  const firstMeta = osuEntries[0]?.beatmap.metadata
  const onlineID = (firstMeta?.beatmapSetID ?? -1) > 0 ? firstMeta!.beatmapSetID : -1
  const fileTransaction = ctx.fileStore?.beginTransaction()
  const checkpoint = ctx.logger.checkpoint()
  const previousTransaction = ctx.fileTransaction
  ctx.fileTransaction = fileTransaction

  try {
    const result = writeRealm(ctx, () => {
      for (const entry of normalized) fileTransaction?.put(entry.buffer, entry.hash)
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
    return result
  } catch (error) {
    try { ctx.logger.discardSince(checkpoint) } finally { fileTransaction?.rollback() }
    throw error
  } finally {
    ctx.fileTransaction = previousTransaction
  }
}
