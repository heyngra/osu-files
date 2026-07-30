import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { readdirSync } from 'fs'
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
  ) {
    if (!readOnly) recoverFileStoreTransactions(basePath)
  }

  /** Returns the canonical path for a SHA-256 file hash. */
  path(hash: string): string {
    validateHash(hash)
    return fileStoragePath(this.basePath, hash)
  }

  /** Returns the resolved root used by transaction recovery. */
  recoveryBasePath(): string {
    return this.basePath
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

  /** Promotes an already hashed temporary file without buffering it. */
  putFile(source: string, hash: string): { hash: string; created: boolean } {
    this.assertWritable()
    validateHash(hash)
    if (this.hasPath(hash) && this.verify(hash)) {
      rmSync(source, { force: true })
      return { hash, created: false }
    }
    this.promote(source, hash)
    return { hash, created: true }
  }

  /** Starts a temporary file transaction for a compound operation.
   * @returns A transaction that must be committed and finalised by its owner.
   * @see FileStoreTransaction
   */
  beginTransaction(): FileStoreTransaction {
    this.assertWritable()
    return new FileStoreTransaction(this)
  }

  /** Reads a file and optionally verifies its content hash.
   * @param hash - SHA-256 content address.
   * @param verify - Recompute the hash before returning. @default true
   * @returns The stored file contents.
   * @throws If the file is missing, invalid, or fails verification.
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
   * @param hash - SHA-256 content address.
   * @returns `true` only when the file exists and matches its address.
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

  /** Checks for a stored path without hashing its contents. */
  hasPath(hash: string): boolean {
    return existsSync(this.path(hash))
  }

  /** Removes a stored file after checking that the session is writable.
   * @param hash - SHA-256 content address.
   * @returns Whether a file was removed.
   * @throws If the store is read-only or the hash is invalid.
   */
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
  private readonly manifestPath: string
  private manifestChanges = 0

  constructor(private readonly store: FileStore) {
    const directory = transactionDirectory()
    mkdirSync(directory, { recursive: true })
    this.manifestPath = join(directory, `${basename(store.path('a'.repeat(64)))}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`)
    this.persistManifest('staged')
  }

  /** Whether this transaction already contains the requested hash. */
  has(hash: string): boolean {
    return this.staged.has(hash) || this.store.verify(hash)
  }

  /** Stages content and returns its content hash.
   * @param content - File contents to stage.
   * @param expectedHash - Optional address to validate against the contents.
   * @returns The content address and whether a new blob was staged.
   */
  put(content: Buffer, expectedHash?: string): { hash: string; created: boolean } {
    if (this.finished) throw new Error('[osu-files] File transaction is finished')
    const hash = sha256(content)
    if (expectedHash !== undefined && expectedHash !== hash)
      throw new Error(`[osu-files] File hash mismatch: expected ${expectedHash}, got ${hash}`)
    validateHash(hash)

    if (this.store.hasPath(hash) && this.store.verify(hash)) return { hash, created: false }
    const existing = this.staged.get(hash)
    if (existing) return { hash, created: false }

    const temporary = this.store.temporaryPath(hash)
    try {
      writeFileSync(temporary, content, { flag: 'wx' })
      const handle = openSync(temporary, 'r+')
      try { fsyncSync(handle) } finally { closeSync(handle) }
      this.staged.set(hash, temporary)
      this.maybePersistManifest()
      return { hash, created: true }
    } catch (error) {
      rmSync(temporary, { force: true })
      throw error
    }
  }

  /** Stages an already hashed temporary file without loading it into memory. */
  putFile(source: string, hash: string): { hash: string; created: boolean } {
    if (this.finished) throw new Error('[osu-files] File transaction is finished')
    validateHash(hash)
    if (!existsSync(source)) throw new Error(`[osu-files] Staged file does not exist: ${source}`)
    if (this.store.hasPath(hash) && this.store.verify(hash)) {
      rmSync(source, { force: true })
      return { hash, created: false }
    }
    if (this.staged.has(hash)) {
      rmSync(source, { force: true })
      return { hash, created: false }
    }
    this.staged.set(hash, source)
    this.maybePersistManifest()
    return { hash, created: true }
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

  /** Publishes staged files. A partial publish is cleaned up on failure.
   * @throws If a staged file cannot be promoted or verified.
   */
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
      this.persistManifest('promoted')
    } catch (error) {
      this.rollback()
      throw error
    }
  }

  /** Finalises a successful owning database operation and removes its recovery manifest.
   * Call this only after the owning Realm transaction has completed successfully.
   */
  finalize(): void {
    rmSync(this.manifestPath, { force: true })
    this.promoted = []
  }

  /** Removes staged content and files created by this transaction. */
  rollback(): void {
    if (this.finished) {
      for (const path of this.promoted) rmSync(path, { force: true })
      this.promoted = []
      rmSync(this.manifestPath, { force: true })
      return
    }
    for (const temporary of this.staged.values()) rmSync(temporary, { force: true })
    for (const path of this.promoted) rmSync(path, { force: true })
    this.staged.clear()
    this.promoted = []
    this.finished = true
    rmSync(this.manifestPath, { force: true })
  }

  private persistManifest(state: 'staged' | 'promoted'): void {
    this.manifestChanges = 0
    const manifest = {
      basePath: this.store.recoveryBasePath(),
      tempPrefix: basename(this.store.recoveryBasePath()),
      pid: process.pid,
      state,
      staged: [...this.staged.values()].filter(path => {
        try { return statSync(path).isFile() } catch { return false }
      }),
      promoted: this.promoted,
    }
    const temporary = `${this.manifestPath}.tmp`
    writeFileSync(temporary, JSON.stringify(manifest), { flag: 'w' })
    const handle = openSync(temporary, 'r+')
    try { fsyncSync(handle) } finally { closeSync(handle) }
    rmSync(this.manifestPath, { force: true })
    promoteFile(temporary, this.manifestPath)
  }

  private maybePersistManifest(): void {
    this.manifestChanges++
    if (this.staged.size === 1 || this.manifestChanges >= 4096)
      this.persistManifest('staged')
  }
}

/** Creates a stable file-store instance for a context. */
export function createFileStore(basePath: string | undefined, readOnly = false): FileStore | undefined {
  return basePath ? new FileStore(resolve(basePath), readOnly) : undefined
}

function transactionDirectory(): string {
  return join(tmpdir(), 'osu-files', 'file-store', 'transactions')
}

function recoverFileStoreTransactions(basePath: string): void {
  const directory = transactionDirectory()
  if (!existsSync(directory)) return
  const resolvedBasePath = resolve(basePath)
  for (const name of readdirSync(directory)) {
    if (!name.endsWith('.json')) continue
    const manifestPath = join(directory, name)
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        basePath?: string
        staged?: string[]
        tempPrefix?: string
        pid?: number
      }
      if (manifest.basePath !== resolvedBasePath) continue
      for (const path of manifest.staged ?? []) rmSync(path, { force: true })
      if (manifest.tempPrefix && manifest.pid) {
        const tempRoot = join(tmpdir(), 'osu-files', 'file-store')
        if (existsSync(tempRoot)) {
          const prefix = `${manifest.tempPrefix}-`
          const processMarker = `-${manifest.pid}-`
          for (const name of readdirSync(tempRoot)) {
            if (name.startsWith(prefix) && name.includes(processMarker) && name.endsWith('.tmp'))
              rmSync(join(tempRoot, name), { force: true })
          }
        }
      }
      rmSync(manifestPath, { force: true })
    } catch {
      // A malformed recovery record is retained for manual inspection.
    }
  }
}

function validateHash(hash: string): void {
  if (!HASH_RE.test(hash)) throw new Error(`[osu-files] Invalid SHA-256 file hash: ${hash}`)
}
