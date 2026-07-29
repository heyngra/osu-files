import { readFileSync } from 'fs'
import { buffer } from 'node:stream/consumers'
import { ZipFile } from 'yazl'
import type { Skin } from '../schema/types.js'
import { fileStoragePath } from '../util.js'

/**
 * Exports a skin to an .osk Buffer for writing to disk.
 * @returns .osk file buffer.
 * @example
 * exportOskData(skin, filesFolderPath) // <Buffer>
 */
export async function exportOskData(skin: Skin, filesFolderPath: string): Promise<Buffer> {
  const zip = new ZipFile()

  for (const fileUsage of skin.Files) {
    const hash = fileUsage.File?.Hash
    const filename = fileUsage.Filename
    if (!hash || !filename) continue

    const storePath = fileStoragePath(filesFolderPath, hash)
    const content = readFileSync(storePath)
    zip.addBuffer(content, filename)
  }

  zip.end()
  return Buffer.from(await buffer(zip.outputStream))
}
