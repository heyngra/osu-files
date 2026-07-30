import type { OsuFilesContext } from './context.js'
import type { BeatmapSet, RealmNamedFileUsage, Skin, Score } from './schema/types.js'
import { fileStoragePath, md5, sha256 } from './util.js'

export type IntegrityIssue = {
  ownerType?: string
  ownerId?: string
  filename?: string
  code: string
  message: string
  severity: 'error' | 'warning'
}

export type IntegrityReport = {
  valid: boolean
  checkedOwners: number
  checkedFiles: number
  errors: IntegrityIssue[]
  warnings: IntegrityIssue[]
}

export type IntegrityOwner = Skin | BeatmapSet | Score

const hashPattern = /^[a-f0-9]{64}$/

export function normalizeFilename(filename: string): string {
  const normalized = filename.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.split('/').some(part => part === '' || part === '.' || part === '..'))
    throw new Error(`Invalid file name '${filename}'`)
  return normalized
}

function content(ctx: OsuFilesContext, hash: string): Buffer {
  if (ctx.fileTransaction?.has(hash)) return ctx.fileTransaction.read(hash)
  if (!ctx.fileStore) throw new Error('filesFolderPath is required')
  return ctx.fileStore.read(hash)
}

export function hashNamedFiles(ctx: OsuFilesContext, usages: Iterable<RealmNamedFileUsage>, predicate?: (filename: string) => boolean): string {
  const files = [...usages]
    .map(usage => ({ filename: normalizeFilename(usage.Filename ?? ''), hash: usage.File?.Hash ?? '' }))
    .filter(file => !predicate || predicate(file.filename))
    .sort((a, b) => a.filename.localeCompare(b.filename))
  return files.length ? sha256(Buffer.concat(files.map(file => content(ctx, file.hash)))) : ''
}

export function computeSkinHash(files: Array<{ filename: string; content: Buffer }>): string
export function computeSkinHash(ctx: OsuFilesContext, usages: Iterable<RealmNamedFileUsage>): string
export function computeSkinHash(first: OsuFilesContext | Array<{ filename: string; content: Buffer }>, second?: Iterable<RealmNamedFileUsage>): string {
  if (Array.isArray(first)) {
    const hashable = first.filter(file => /\.(?:ini|json)$/i.test(normalizeFilename(file.filename))).sort((a, b) => a.filename.localeCompare(b.filename))
    return hashable.length ? sha256(Buffer.concat(hashable.map(file => file.content))) : ''
  }
  return hashNamedFiles(first, second ?? [], filename => /\.(?:ini|json)$/i.test(filename))
}

export function computeSkinContentHash(ctx: OsuFilesContext, usages: Iterable<RealmNamedFileUsage>): string {
  return hashNamedFiles(ctx, usages)
}

export function computeBeatmapSetHash(ctx: OsuFilesContext, usages: Iterable<RealmNamedFileUsage>): string {
  return hashNamedFiles(ctx, usages, filename => /\.osu$/i.test(filename))
}

export function validateFileReference(ctx: OsuFilesContext, usage: RealmNamedFileUsage, ownerType?: string, ownerId?: string): void {
  const filename = normalizeFilename(usage.Filename ?? '')
  const hash = usage.File?.Hash
  if (!hash || !hashPattern.test(hash)) throw new Error(`Invalid file reference '${filename}'${ownerType ? ` on ${ownerType} '${ownerId}'` : ''}`)
  const bytes = content(ctx, hash)
  if (sha256(bytes) !== hash) throw new Error(`File '${filename}' does not match its SHA-256 hash '${hash}'`)
}

export function validateOwnerFiles(ctx: OsuFilesContext, owner: IntegrityOwner): void {
  const seen = new Set<string>()
  for (const usage of owner.Files ?? []) {
    const filename = normalizeFilename(usage.Filename ?? '')
    const key = filename.toLowerCase()
    if (seen.has(key)) throw new Error(`Duplicate file reference '${filename}'`)
    seen.add(key)
    validateFileReference(ctx, usage, owner.constructor?.name, String((owner as any).ID ?? ''))
  }
}

export function validateOwnerHashes(ctx: OsuFilesContext, owner: IntegrityOwner): void {
  validateOwnerFiles(ctx, owner)
  if ('Creator' in owner) {
    const expected = computeSkinHash(ctx, owner.Files)
    if ((owner.Hash ?? '') !== expected) throw new Error(`Skin '${owner.Name ?? owner.ID}' has an invalid hash`)
    return
  }
  if ('Beatmaps' in owner) {
    const expected = computeBeatmapSetHash(ctx, owner.Files)
    if ((owner.Hash ?? '') !== expected) throw new Error(`BeatmapSet '${owner.ID}' has an invalid hash`)
    for (const beatmap of owner.Beatmaps ?? []) {
      const usage = owner.Files.find(file => file.File?.Hash === beatmap.Hash)
      if (!usage) throw new Error(`Beatmap '${beatmap.ID}' is missing its referenced .osu file`)
      const bytes = content(ctx, beatmap.Hash ?? '')
      if (md5(bytes) !== beatmap.MD5Hash) throw new Error(`Beatmap '${beatmap.ID}' has an invalid MD5 hash`)
    }
    return
  }
  const replay = owner.Files.find(file => /\.osr$/i.test(file.Filename ?? ''))
  if (replay && owner.Hash && replay.File?.Hash !== owner.Hash)
    throw new Error(`Score '${owner.ID}' has an invalid replay reference`)
}

export function validateDatabaseIntegrity(ctx: OsuFilesContext): IntegrityReport {
  const report: IntegrityReport = { valid: true, checkedOwners: 0, checkedFiles: 0, errors: [], warnings: [] }
  const check = (ownerType: string, owner: IntegrityOwner): void => {
    report.checkedOwners++
    try { validateOwnerHashes(ctx, owner) } catch (error) {
      report.errors.push({ ownerType, ownerId: String((owner as any).ID), code: 'invalid-owner', message: error instanceof Error ? error.message : String(error), severity: 'error' })
    }
  }
  for (const file of ctx.realm.objects<any>('File')) {
    report.checkedFiles++
    if (!file.Hash || !hashPattern.test(file.Hash)) report.errors.push({ ownerType: 'File', ownerId: String(file.Hash), code: 'invalid-hash', message: 'File has an invalid SHA-256 hash', severity: 'error' })
    else { try { if (!ctx.fileStore?.verify(file.Hash)) throw new Error('blob missing or corrupt') } catch (error) { report.errors.push({ ownerType: 'File', ownerId: file.Hash, code: 'invalid-blob', message: `File blob is ${error instanceof Error ? error.message : String(error)}`, severity: 'error' }) } }
  }
  for (const owner of ctx.realm.objects<Skin>('Skin')) check('Skin', owner)
  for (const owner of ctx.realm.objects<BeatmapSet>('BeatmapSet')) check('BeatmapSet', owner)
  for (const owner of ctx.realm.objects<Score>('Score')) check('Score', owner)
  report.valid = report.errors.length === 0
  return report
}

export function fullSkinContentHash(ctx: OsuFilesContext, skin: Skin): string {
  return computeSkinContentHash(ctx, skin.Files)
}

export type IntegrityModule = {
  check(): IntegrityReport
  repair(): IntegrityReport
}

export function createIntegrityModule(ctx: OsuFilesContext): IntegrityModule {
  return {
    check: () => validateDatabaseIntegrity(ctx),
    repair: () => {
      if (ctx.readOnly) throw new Error('[osu-files] Database is read-only')
      const before = validateDatabaseIntegrity(ctx)
      const repairable = [...ctx.realm.objects<any>('Skin'), ...ctx.realm.objects<any>('BeatmapSet')]
      for (const owner of repairable) {
        try {
          validateOwnerFiles(ctx, owner)
          const hash = 'Creator' in owner ? computeSkinHash(ctx, owner.Files) : computeBeatmapSetHash(ctx, owner.Files)
          if (owner.Hash !== hash) ctx.realm.write(() => { owner.Hash = hash })
        } catch {
          // Repair is deliberately conservative: invalid or ambiguous references are reported, never guessed.
        }
      }
      return validateDatabaseIntegrity(ctx)
    },
  }
}
