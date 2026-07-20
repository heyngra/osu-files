import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, sep } from 'path'
import { open as openZip } from 'yauzl'
import type { OsuFilesContext } from '../context.js'
import { parseOsu } from '../beatmap/parse.js'
import type { OsuBeatmap } from '../beatmap/types.js'
import type { BeatmapSetData } from './types.js'
import { importSet, type ImportSetInput } from '../write/set-import.js'

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

function md5(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex')
}

function fileStoragePath(base: string, hash: string): string {
  return join(base, hash[0], hash.substring(0, 2), hash)
}

function ensureParentDir(p: string): void {
  const dir = p.substring(0, p.lastIndexOf(sep))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function normalizeFilename(name: string): string {
  return name.replace(/\\/g, '/')
}

export type ZipEntry = { filename: string; buffer: Buffer }

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

function detectCommonPrefix(filenames: string[]): string {
  if (filenames.length <= 1) return ''
  const sorted = [...filenames].sort()
  const first = sorted[0]; const last = sorted[sorted.length - 1]
  let i = 0
  while (i < first.length && i < last.length && first[i] === last[i]) i++
  const prefix = first.substring(0, i)
  const lastSlash = prefix.lastIndexOf('/')
  return lastSlash >= 0 ? prefix.substring(0, lastSlash + 1) : ''
}

function stripPrefix(filename: string, prefix: string): string {
  return prefix && filename.startsWith(prefix) ? filename.substring(prefix.length) : filename
}

function computeSetHash(osuFiles: { filename: string; content: Buffer }[]): string {
  const sorted = [...osuFiles].sort((a, b) => a.filename.localeCompare(b.filename))
  const hash = createHash('sha256')
  for (const f of sorted) hash.update(f.content)
  return hash.digest('hex')
}

type ProcessedEntry = { filename: string; buffer: Buffer; hash: string }
type OsuEntry = { filename: string; buffer: Buffer; hash: string; md5Hash: string; beatmap: OsuBeatmap }

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
