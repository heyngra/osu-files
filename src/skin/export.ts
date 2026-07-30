import { readFileSync } from 'fs'
import { buffer } from 'node:stream/consumers'
import { ZipFile } from 'yazl'
import type { Skin } from '../schema/types.js'
import { fileStoragePath } from '../util.js'
import { sha256 } from '../util.js'
import { normalizeFilename } from '../integrity.js'

/**
 * Exports a skin to an .osk Buffer for writing to disk.
 * @returns .osk file buffer.
 * @example
 * exportOskData(skin, filesFolderPath) // <Buffer>
 */
export async function exportOskData(skin: Skin, filesFolderPath: string): Promise<Buffer> {
  const zip = new ZipFile()
  const names = new Set<string>()

  for (const fileUsage of skin.Files) {
    const hash = fileUsage.File?.Hash
    const filename = fileUsage.Filename
    if (!hash || !filename) throw new Error(`Skin '${skin.ID}' contains an invalid file reference`)
    const normalized = normalizeFilename(filename)
    const key = normalized.toLowerCase()
    if (names.has(key)) throw new Error(`Skin '${skin.ID}' contains duplicate file '${normalized}'`)
    names.add(key)

    const storePath = fileStoragePath(filesFolderPath, hash)
    const content = readFileSync(storePath)
    if (sha256(content) !== hash) throw new Error(`Skin '${skin.ID}' file '${normalized}' failed hash verification`)
    zip.addBuffer(content, normalized)
  }

  zip.end()
  return Buffer.from(await buffer(zip.outputStream))
}
