import { sha256 } from './hash.js'

type RealmFileLike = { Hash?: string }
type NamedFileUsageLike = { File?: RealmFileLike; Filename?: string }

/** A filename paired with a file hash or content. */
export class FileRef {
  readonly filename: string
  readonly hash?: string
  readonly content?: Buffer

  constructor(
    first: string | RealmFileLike | NamedFileUsageLike,
    second?: string | { hash?: string; content?: Buffer },
    ctx?: { files: { get: { byHash: (h: string) => ReadonlyArray<RealmFileLike> } } },
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
    if (second === undefined) {
      this.filename = filename
      return
    }
    const source = second as { hash?: string; content?: Buffer }
    let hash = source.hash
    const content = source.content

    if (content && !hash) {
      hash = sha256(content)
    }

    if (!hash) {
      this.filename = filename
      return
    }

    if (!/^[a-f0-9]{64}$/.test(hash))
      throw new Error(`FileRef '${filename}' has an invalid SHA-256 hash`)

    if (!content && ctx) {
      if (!ctx.files.get.byHash(hash)[0]) {
        throw new Error(`File '${filename}' with hash ${hash} not found in realm database`)
      }
    }

    this.filename = filename
    this.hash = hash
    this.content = content
  }
}
