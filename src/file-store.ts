import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { basename, join, resolve } from 'path'
import { tmpdir } from 'os'
import { fileStoragePath, ensureParentDir, promoteFile, sha256 } from './util.js'

const HASH_RE = /^[a-f0-9]{64}$/

/** A verified content-addressed file store.
 * @example
 * const store = new FileStore('./files')
 * const stored = store.put(Buffer.from('data'))
 */
export class FileStore {
  constructor(
    private readonly basePath: string,
    private readonly readOnly = false,
  ) {}

  /** Returns the canonical path for a SHA-256 file hash. */
  path(hash: string): string {
    validateHash(hash)
    return fileStoragePath(this.basePath, hash)
  }

  /** Stores content after checking or calculating its SHA-256 hash.
   * @example
   * const { hash } = store.put(content)
   */
  put(content: Buffer, expectedHash?: string): { hash: string; created: boolean } {
    this.assertWritable()
    const hash = sha256(content)
    if (expectedHash !== undefined && expectedHash !== hash)
      throw new Error(`[osu-files] File hash mismatch: expected ${expectedHash}, got ${hash}`)

    const destination = this.path(hash)
    if (existsSync(destination)) {
      if (sha256(readFileSync(destination)) === hash)
        return { hash, created: false }
    }

    ensureParentDir(destination)
    const temporary = this.tempPath(hash)
    try {
      writeFileSync(temporary, content, { flag: 'wx' })
      const handle = openSync(temporary, 'r+')
      try { fsyncSync(handle) } finally { closeSync(handle) }

      this.promote(temporary, hash)
      return { hash, created: true }
    } catch (error) {
      rmSync(temporary, { force: true })
      throw error
    }
  }

  /** Starts a temporary file transaction for a compound operation. */
  beginTransaction(): FileStoreTransaction {
    this.assertWritable()
    return new FileStoreTransaction(this)
  }

  /** Reads a file and optionally verifies its content hash.
   * @example
   * const content = store.read(hash)
   */
  read(hash: string, verify = true): Buffer {
    const path = this.path(hash)
    const content = readFileSync(path)
    if (verify && sha256(content) !== hash)
      throw new Error(`Stored file failed verification: ${path}`)
    return content
  }

  /** Verifies a stored file without returning its content.
   * @example
   * if (!store.verify(hash)) throw new Error('Corrupt file')
   */
  verify(hash: string): boolean {
    try {
      this.read(hash)
      return true
    } catch {
      return false
    }
  }

  /** Removes a stored file after checking that the session is writable. */
  remove(hash: string): boolean {
    this.assertWritable()
    const path = this.path(hash)
    if (!existsSync(path)) return false
    rmSync(path)
    return true
  }

  private tempPath(hash: string): string {
    const root = join(tmpdir(), 'osu-files', 'file-store')
    mkdirSync(root, { recursive: true })
    return join(root, `${basename(this.basePath)}-${hash}-${process.pid}-${Date.now()}.tmp`)
  }

  private assertWritable(): void {
    if (this.readOnly) throw new Error('[osu-files] File store is read-only')
  }

  promote(temporary: string, hash: string): string {
    this.assertWritable()
    const destination = this.path(hash)
    ensureParentDir(destination)
    if (existsSync(destination)) {
      if (sha256(readFileSync(destination)) === hash) {
        rmSync(temporary, { force: true })
        return destination
      }
    }

    promoteFile(temporary, destination)
    try {
      if (sha256(readFileSync(destination)) !== hash)
        throw new Error(`Stored file failed verification: ${destination}`)
    } catch (error) {
      rmSync(destination, { force: true })
      throw error
    }
    return destination
  }

  temporaryPath(hash: string): string {
    return this.tempPath(hash)
  }
}

/** Buffers new blobs in `%TEMP%` until the owning Realm operation succeeds. */
export class FileStoreTransaction {
  private readonly staged = new Map<string, string>()
  private promoted: string[] = []
  private finished = false

  constructor(private readonly store: FileStore) {}

  /** Whether this transaction already contains the requested hash. */
  has(hash: string): boolean {
    return this.staged.has(hash) || this.store.verify(hash)
  }

  /** Stages content and returns its content hash. */
  put(content: Buffer, expectedHash?: string): { hash: string; created: boolean } {
    if (this.finished) throw new Error('[osu-files] File transaction is finished')
    const hash = sha256(content)
    if (expectedHash !== undefined && expectedHash !== hash)
      throw new Error(`[osu-files] File hash mismatch: expected ${expectedHash}, got ${hash}`)
    validateHash(hash)

    if (this.store.verify(hash)) return { hash, created: false }
    const existing = this.staged.get(hash)
    if (existing) return { hash, created: false }

    const temporary = this.store.temporaryPath(hash)
    try {
      writeFileSync(temporary, content, { flag: 'wx' })
      const handle = openSync(temporary, 'r+')
      try { fsyncSync(handle) } finally { closeSync(handle) }
      this.staged.set(hash, temporary)
      return { hash, created: true }
    } catch (error) {
      rmSync(temporary, { force: true })
      throw error
    }
  }

  /** Reads staged content or the committed file for a hash. */
  read(hash: string): Buffer {
    const temporary = this.staged.get(hash)
    if (temporary) {
      const content = readFileSync(temporary)
      if (sha256(content) !== hash) throw new Error(`Staged file failed verification: ${temporary}`)
      return content
    }
    return this.store.read(hash)
  }

  /** Publishes staged files. A partial publish is cleaned up on failure. */
  commit(): void {
    if (this.finished) return
    try {
      for (const [hash, temporary] of this.staged) {
        const existed = this.store.verify(hash)
        const destination = this.store.promote(temporary, hash)
        if (!existed) this.promoted.push(destination)
      }
      this.finished = true
      this.staged.clear()
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  /** Removes staged content and files created by this transaction. */
  rollback(): void {
    if (this.finished) {
      for (const path of this.promoted) rmSync(path, { force: true })
      this.promoted = []
      return
    }
    for (const temporary of this.staged.values()) rmSync(temporary, { force: true })
    for (const path of this.promoted) rmSync(path, { force: true })
    this.staged.clear()
    this.promoted = []
    this.finished = true
  }
}

/** Creates a stable file-store instance for a context. */
export function createFileStore(basePath: string | undefined, readOnly = false): FileStore | undefined {
  return basePath ? new FileStore(resolve(basePath), readOnly) : undefined
}

function validateHash(hash: string): void {
  if (!HASH_RE.test(hash)) throw new Error(`[osu-files] Invalid SHA-256 file hash: ${hash}`)
}
