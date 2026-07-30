import { readFileSync, rmSync } from 'fs'
import { createHash } from 'crypto'
import { readZipEntriesToFiles } from '../osz/import.js'
import { detectCommonPrefix, stripPrefix } from '../util.js'
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
  entries: Array<{ filename: string; hash: string }>
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
  const entries = await readZipEntriesToFiles(filePath, limits)
  if (entries.length === 0) throw new Error('Empty archive')

  const archiveName = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.osk$/i, '') ?? 'No name'

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const processed = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    path: e.path,
    hash: e.hash,
  }))
  const store = fileStore ?? createFileStore(filesFolderPath)

  try {
    const hashable = processed
      .filter(entry => HASHABLE_SKIN_EXTS.some(ext => entry.filename.toLowerCase().endsWith(ext)))
      .sort((a, b) => a.filename.localeCompare(b.filename))
    const skinDigest = createHash('sha256')
    for (const entry of hashable) skinDigest.update(readFileSync(entry.path))
    const skinHash = hashable.length > 0 ? skinDigest.digest('hex') : ''

    const skinIniEntry = processed.find(e => e.filename.toLowerCase() === 'skin.ini')
    const skinIniMeta = skinIniEntry
      ? parseSkinIni(readFileSync(skinIniEntry.path, 'utf8')).general
      : {}

    const skinInfoEntry = processed.find(e => e.filename.toLowerCase() === 'skininfo.json')
    let instantiationInfo = ''
    if (skinInfoEntry) {
      try {
        const parsed = JSON.parse(readFileSync(skinInfoEntry.path, 'utf8'))
        if (parsed.InstantiationInfo) instantiationInfo = parsed.InstantiationInfo
      } catch {
      }
    }

    let name = skinIniMeta.name || archiveName
    const creator = skinIniMeta.author || 'Unknown'

    if (skinIniMeta.name && archiveName !== name && archiveName !== name.replace(/[<>:"/\\|?*]/g, ''))
      name = `${name} [${archiveName}]`

    for (const entry of processed)
      transaction?.putFile(entry.path, entry.hash) ?? store?.putFile(entry.path, entry.hash)

    return {
      entries: processed.map(e => ({ filename: e.filename, hash: e.hash })),
      skinHash,
      name,
      creator,
      instantiationInfo,
    }
  } finally {
    if (!transaction)
      for (const entry of entries) rmSync(entry.path, { force: true })
  }
}
