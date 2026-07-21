import { existsSync, writeFileSync } from 'fs'
import type { Skin } from '../schema/types.js'
import { readZipEntries } from '../osz/import.js'
import { sha256, fileStoragePath, ensureParentDir, detectCommonPrefix, stripPrefix, computeHash } from '../util.js'
import { parseSkinIni } from './skin-ini.js'

const HASHABLE_SKIN_EXTS = ['.ini', '.json']

export type ImportedSkinData = {
  id: string
  name: string
  creator: string
  hash: string
  files: number
}

export type ImportSkinEntries = {
  entries: Array<{ filename: string; hash: string; buffer: Buffer }>
  skinHash: string
  name: string
  creator: string
  instantiationInfo: string
}

export async function importOskEntries(filePath: string, filesFolderPath: string): Promise<ImportSkinEntries> {
  const entries = await readZipEntries(filePath)
  if (entries.length === 0) throw new Error('Empty archive')

  const archiveName = filePath.replace(/\\/g, '/').split('/').pop()?.replace(/\.osk$/i, '') ?? 'No name'

  const prefix = detectCommonPrefix(entries.map(e => e.filename))
  const processed = entries.map(e => ({
    filename: stripPrefix(e.filename, prefix),
    buffer: e.buffer,
    hash: sha256(e.buffer),
  }))

  for (const entry of processed) {
    const storePath = fileStoragePath(filesFolderPath, entry.hash)
    if (!existsSync(storePath)) {
      ensureParentDir(storePath)
      writeFileSync(storePath, entry.buffer)
    }
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
