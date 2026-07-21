import { createHash } from 'crypto'
import { existsSync, mkdirSync } from 'fs'
import { join, sep } from 'path'

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

export function md5(buf: Buffer): string {
  return createHash('md5').update(buf).digest('hex')
}

export function fileStoragePath(base: string, hash: string): string {
  return join(base, hash[0], hash.substring(0, 2), hash)
}

export function ensureParentDir(p: string): void {
  const dir = p.substring(0, p.lastIndexOf(sep))
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

export function normalizeFilename(name: string): string {
  return name.replace(/\\/g, '/')
}

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

export function stripPrefix(filename: string, prefix: string): string {
  return prefix && filename.startsWith(prefix) ? filename.substring(prefix.length) : filename
}

export function computeHash(files: { filename: string; buffer: Buffer }[], hashableExts: string[]): string {
  const hashable = files
    .filter(f => hashableExts.some(ext => f.filename.toLowerCase().endsWith(ext)))
    .sort((a, b) => a.filename.localeCompare(b.filename))

  if (hashable.length === 0) return ''

  const hash = createHash('sha256')
  for (const f of hashable) hash.update(f.buffer)
  return hash.digest('hex')
}
