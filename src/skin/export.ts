import { readFileSync } from 'fs'
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

  for (const fileUsage of skin.Files as any[]) {
    const hash: string = fileUsage.File?.Hash
    const filename: string = fileUsage.Filename
    if (!hash) continue

    const storePath = fileStoragePath(filesFolderPath, hash)
    const content = readFileSync(storePath)
    zip.addBuffer(content, filename)
  }

  const chunks: Buffer[] = []
  zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk))
  zip.end()
  return new Promise((resolve, reject) => {
    zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
    zip.outputStream.on('error', reject)
  })
}
