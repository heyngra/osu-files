import { createHash } from 'crypto'

type RealmFileLike = { Hash?: string }
type NamedFileUsageLike = { File?: RealmFileLike; Filename?: string }

export class FileRef {
  filename: string
  hash?: string
  content?: Buffer

  constructor(
    first: string | RealmFileLike | NamedFileUsageLike,
    second?: string | { hash?: string; content?: Buffer },
    ctx?: { files: { get: { byHashEquals: (h: string) => RealmFileLike[] } } },
  ) {
    if (typeof first === 'object' && 'File' in first) {
      const usage = first as NamedFileUsageLike
      this.filename = usage.Filename ?? ''
      this.hash = usage.File?.Hash
      if (!this.hash) throw new Error(`FileRef from NamedFileUsage has no hash`)
      return
    }

    if (typeof first === 'object' && 'Hash' in first) {
      this.filename = second as string
      this.hash = (first as RealmFileLike).Hash
      if (!this.hash) throw new Error(`FileRef from File object has no hash`)
      if (!this.filename) throw new Error(`FileRef from File object needs a filename`)
      return
    }

    const filename = first as string
    const source = second as { hash?: string; content?: Buffer }
    let hash = source.hash
    const content = source.content

    if (content && !hash) {
      hash = createHash('sha256').update(content).digest('hex')
    }

    if (!hash) {
      throw new Error(`FileRef '${filename}' must specify hash or content`)
    }

    if (!content && ctx) {
      if (!ctx.files.get.byHashEquals(hash)[0]) {
        throw new Error(`File '${filename}' with hash ${hash} not found in realm database`)
      }
    }

    this.filename = filename
    this.hash = hash
    this.content = content
  }
}
