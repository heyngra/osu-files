import { existsSync, writeFileSync } from 'fs'
import { open as openZip } from 'yauzl'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from '../beatmap/parse.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from './types.js'
import { importSet, type ImportSetInput } from '../write/set-import.js'
import { sha256, md5, fileStoragePath, ensureParentDir, normalizeFilename, detectCommonPrefix, stripPrefix } from '../util.js'

/** A single entry read from a zip archive. */
export type ZipEntry = { filename: string; buffer: Buffer }

/**
 * Reads all entries from a zip file.
 * @returns Array of zip entries with filename and buffer.
 * @example
 * readZipEntries('/path/to/file.osz') // [{ filename: 'song.osu', buffer: <Buffer> }]
 */
export function readZipEntries(filePath: string): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ZipEntry[] = []
    openZip(filePath, { lazyEntries: true, decodeStrings: true }, (err, zipfile) => {
      if (err) return reject(err)
      if (!zipfile) return reject(new Error('Failed to open zip'))
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) { zipfile.readEntry(); return }
        const chunks: Buffer[] = []
        zipfile.openReadStream(entry, (err2, rs) => {
          if (err2) return reject(err2)
          if (!rs) return reject(new Error('No read stream'))
          rs.on('data', (chunk: Buffer) => chunks.push(chunk))
          rs.on('end', () => {
            entries.push({ filename: normalizeFilename(entry.fileName), buffer: Buffer.concat(chunks) })
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

  const entries = await readZipEntries(filePath)
  if (entries.length === 0) throw new Error('Empty archive')

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const normalized: ProcessedEntry[] = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    buffer: e.buffer,
    hash: sha256(e.buffer),
  }))

  for (const entry of normalized) {
    const storePath = fileStoragePath(ctx.filesFolderPath, entry.hash)
    if (!existsSync(storePath)) {
      ensureParentDir(storePath)
      writeFileSync(storePath, entry.buffer)
    }
  }

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

  const setHash = computeSetHash(osuEntries.map(e => ({ filename: e.filename, content: e.buffer })))
  const firstMeta = osuEntries[0]?.beatmap.metadata
  const onlineID = (firstMeta?.beatmapSetID ?? -1) > 0 ? firstMeta!.beatmapSetID : -1

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
}
