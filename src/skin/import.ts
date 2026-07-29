import { readZipEntries } from '../osz/import.js'
import { sha256, detectCommonPrefix, stripPrefix, computeHash } from '../util.js'
import { parseSkinIni } from './skin-ini.js'
import { createFileStore, type FileStore, type FileStoreTransaction } from '../file-store.js'
import type { ArchiveLimits } from '../osz/import.js'

const HASHABLE_SKIN_EXTS = ['.ini', '.json']

/** Summary of an imported .osk skin. */
export type ImportedSkinData = {
  id: string
  name: string
  creator: string
  hash: string
  files: number
}

/** Raw data extracted from an .osk archive. */
export type ImportSkinEntries = {
  entries: Array<{ filename: string; hash: string; buffer: Buffer }>
  skinHash: string
  name: string
  creator: string
  instantiationInfo: string
}

/**
 * Reads .osk file entries and stores them on disk, returning parsed skin metadata.
 * @returns Extracted skin entries with metadata.
 * @throws If archive is empty.
 * @example
 * importOskEntries('/path/to/skin.osk', filesFolderPath) // { entries: [...], skinHash: '...', name: 'My Skin', ... }
 */
export async function importOskEntries(filePath: string, filesFolderPath: string, fileStore?: FileStore, limits?: ArchiveLimits, transaction?: FileStoreTransaction): Promise<ImportSkinEntries> {
  const entries = await readZipEntries(filePath, limits)
  if (entries.length === 0) throw new Error('Empty archive')

  const archiveName = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.osk$/i, '') ?? 'No name'

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const processed = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    buffer: e.buffer,
    hash: sha256(e.buffer),
  }))
  const store = fileStore ?? createFileStore(filesFolderPath)

  for (const entry of processed) {
    transaction?.put(entry.buffer, entry.hash) ?? store?.put(entry.buffer, entry.hash)
  }

  const skinHash = computeHash(processed, HASHABLE_SKIN_EXTS)

  const skinIniEntry = processed.find(e => e.filename.toLowerCase() === 'skin.ini')
  const skinIniMeta = skinIniEntry
    ? parseSkinIni(skinIniEntry.buffer.toString('utf-8')).general
    : {}

  const skinInfoEntry = processed.find(e => e.filename.toLowerCase() === 'skininfo.json')
  let instantiationInfo = ''
  if (skinInfoEntry) {
    try {
      const parsed = JSON.parse(skinInfoEntry.buffer.toString('utf-8'))
      if (parsed.InstantiationInfo) instantiationInfo = parsed.InstantiationInfo
    } catch {
    }
  }

  let name = skinIniMeta.name || archiveName
  const creator = skinIniMeta.author || 'Unknown'

  if (skinIniMeta.name && archiveName !== name && archiveName !== name.replace(/[<>:"/\\|?*]/g, ''))
    name = `${name} [${archiveName}]`

  return {
    entries: processed.map(e => ({ filename: e.filename, hash: e.hash, buffer: e.buffer })),
    skinHash,
    name,
    creator,
    instantiationInfo,
  }
}
