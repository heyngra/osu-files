import { createHash } from 'crypto'
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, renameSync, rmSync, writeFileSync } from 'fs'
import { basename, join, resolve, sep } from 'path'
import { tmpdir } from 'os'

/**
 * Computes SHA-256 hex digest.
 * @returns SHA-256 hex digest.
 * @example
 * sha256(buffer) // 'a1b2c3...'
 */
export function sha256(buf: Uint8Array): string {
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * Computes MD5 hex digest.
 * @returns MD5 hex digest.
 * @example
 * md5(buffer) // 'd4e5f6...'
 */
export function md5(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex')
}

/**
 * Builds a content-addressable path: `<base>/a/ab/abcdef...`.
 * @returns Content-addressable path under base.
 * @example
 * fileStoragePath('/store', 'abcdef123') // '/store/a/ab/abcdef123'
 */
export function fileStoragePath(base: string, hash: string): string {
  if (!/^[a-f0-9]{64}$/.test(hash))
    throw new Error(`Invalid SHA-256 file hash: ${hash}`)
  const path = join(base, hash[0], hash.substring(0, 2), hash)
  const root = resolve(base)
  const resolved = resolve(path)
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new Error('File hash resolves outside the files folder')
  }
  return path
}

/**
 * Creates parent directory if it does not exist.
 * @example
 * ensureParentDir('/store/a/ab/abc') // creates /store/a/ab
 */
export function ensureParentDir(p: string): void {
  const dir = p.substring(0, p.lastIndexOf(sep))
  if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/** Writes a file through `%TEMP%` and promotes it to the requested path. */
export function writeFileAtomic(path: string, content: Buffer | string): void {
  const temporary = temporaryFilePath('output')
  try {
    writeFileSync(temporary, content, { flag: 'wx' })
    const handle = openSync(temporary, 'r+')
    try { fsyncSync(handle) } finally { closeSync(handle) }
    promoteFile(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

/** Creates a temporary path without creating the file. */
export function temporaryFilePath(prefix: string): string {
  const directory = join(tmpdir(), 'osu-files', 'outputs')
  mkdirSync(directory, { recursive: true })
  return join(directory, `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`)
}

/** Promotes a temporary file without exposing a partial destination. */
export function promoteFile(source: string, destination: string): void {
  const backup = temporaryFilePath(`promotion-backup-${basename(destination)}`)
  const hadDestination = existsSync(destination)
  let destinationBackedUp = false
  try {
    if (hadDestination) {
      copyFileSync(destination, backup)
      syncFile(backup)
      destinationBackedUp = true
    }

    try {
      renameSync(source, destination)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'EXDEV') {
        copyFileSync(source, destination)
        syncFile(destination)
        rmSync(source, { force: true })
      } else if (existsSync(destination)) {
        rmSync(destination)
        renameSync(source, destination)
      } else {
        throw error
      }
    }
    syncFile(destination)
  } catch (error) {
    if (destinationBackedUp) {
      try {
        copyFileSync(backup, destination)
        syncFile(destination)
      } catch { }
    } else {
      rmSync(destination, { force: true })
    }
    rmSync(source, { force: true })
    throw error
  } finally {
    rmSync(backup, { force: true })
  }
}

function syncFile(path: string): void {
  const handle = openSync(path, 'r+')
  try { fsyncSync(handle) } finally { closeSync(handle) }
}

/**
 * Converts backslashes to forward slashes.
 * @returns Normalized filename with forward slashes.
 * @example
 * normalizeFilename('foo\\bar.txt') // 'foo/bar.txt'
 */
export function normalizeFilename(name: string): string {
  return name.replace(/\\/g, '/')
}

/**
 * Finds the common directory prefix shared by all filenames.
 * @returns Common directory prefix or empty string.
 * @example
 * detectCommonPrefix(['dir/a.txt', 'dir/b.txt']) // 'dir/'
 */
export function detectCommonPrefix(filenames: string[]): string {
  if (filenames.length <= 1) return ''
  const sorted = [...filenames].sort()
  const first = sorted[0]; const last = sorted[sorted.length - 1]
  let i = 0
  while (i < first.length && i < last.length && first[i] === last[i]) i++
  const prefix = first.substring(0, i)
  const lastSlash = prefix.lastIndexOf('/')
  return lastSlash >= 0 ? prefix.substring(0, lastSlash + 1) : ''
}

/**
 * Removes a prefix from a filename, returning the original if it doesn't match.
 * @returns Filename with prefix removed.
 * @example
 * stripPrefix('dir/a.txt', 'dir/') // 'a.txt'
 */
export function stripPrefix(filename: string, prefix: string): string {
  return prefix && filename.startsWith(prefix) ? filename.substring(prefix.length) : filename
}

/**
 * Computes SHA-256 hash over sorted files matching given extensions.
 * @returns SHA-256 hex digest of sorted hashable files, or empty string.
 * @example
 * computeHash(files, ['.osu', '.osb']) // 'abc123...'
 */
export function computeHash(files: { filename: string; buffer: Buffer }[], hashableExts: string[]): string {
  const hashable = files
    .filter(f => hashableExts.some(ext => f.filename.toLowerCase().endsWith(ext)))
    .sort((a, b) => a.filename.localeCompare(b.filename))

  if (hashable.length === 0) return ''

  const hash = createHash('sha256')
  for (const f of hashable) hash.update(f.buffer)
  return hash.digest('hex')
}
