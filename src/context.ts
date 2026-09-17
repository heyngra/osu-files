import type Realm from 'realm'
import type { RollbackLogger } from './write/logger.js'
import type { FileStore } from './file-store.js'
import type { RealmSession } from './realm-session.js'
import type { ArchiveLimits } from './osz/import.js'
import type { FileStoreTransaction } from './file-store.js'
import { registerRealmEditHooks, registerRealmGeneration, registerRealmWriteHooks } from './get/base.js'
import { LogAction, snapshot } from './write/logger.js'
import type { BeatmapModule } from './beatmaps.js'
import type { ScoreModule } from './scores.js'
import type { BeatmapSetModule } from './sets.js'
import type { FileModule } from './files.js'
import type { RulesetModule } from './rulesets.js'
import type { RulesetSettingModule } from './rulesetsettings.js'
import type { SkinModule } from './skins.js'
import type { BeatmapMetadataModule } from './metadata.js'
import type { IntegrityModule } from './integrity.js'
import { computeSkinHash, computeBeatmapSetHash, validateOwnerHashes } from './integrity.js'

/**
 * Shared context passed to all modules.
 * @example
 * if (hasFilesFolder({ filesFolderPath: './files' })) { ... }
 */
export type OsuFilesContext = {
  realm: Realm
  session: RealmSession
  logger: RollbackLogger
  fileStore?: FileStore
  readOnly: boolean
  archiveLimits?: ArchiveLimits
  fileTransaction?: FileStoreTransaction
  queryGeneration: { value: number }
  filesFolderPath?: string
  checkHash?: boolean
  queryCache?: boolean
  beatmaps: BeatmapModule
  scores: ScoreModule
  sets: BeatmapSetModule
  files: FileModule
  rulesets: RulesetModule
  rulesetSettings: RulesetSettingModule
  skins: SkinModule
  metadata: BeatmapMetadataModule
  integrity: IntegrityModule
}

/**
 * Returns `true` when a files folder path is configured.
 * @returns Whether filesFolderPath is configured.
 * @example
 * import { hasFilesFolder } from 'osu-files'
 *
 * return hasFilesFolder({ filesFolderPath: './files' })
 */
export function hasFilesFolder(ctx: Pick<OsuFilesContext, 'filesFolderPath'>): boolean {
  return !!ctx.filesFolderPath
}

/** Rejects a mutation before it can touch Realm or the file store. */
export function assertWritable(ctx: OsuFilesContext): void {
  ctx.session.assertOpen()
  if (ctx.readOnly) throw new Error('[osu-files] Database is read-only')
}

/** Runs a Realm write without nesting a transaction during compound operations. */
export function writeRealm<T>(ctx: OsuFilesContext, action: () => T): T {
  const realm = ctx.realm as Realm & { isInTransaction?: boolean }
  return realm.isInTransaction ? action() : realm.write(action)
}

/** Marks Realm writes so cached query snapshots can be refreshed. */
export function markChanged(ctx: OsuFilesContext): void {
  ctx.queryGeneration.value++
}

export function registerContextGeneration(ctx: OsuFilesContext): void {
  registerRealmGeneration(ctx.realm, () => ctx.queryGeneration.value, () => ctx.queryGeneration.value++)
  registerRealmEditHooks(ctx.realm, {
    snapshot,
    validate: (realm, entity, primaryKey) => {
      if (entity === 'Skin' || entity === 'BeatmapSet' || entity === 'Score') {
        const owner = realm.objectForPrimaryKey<Record<string, unknown>>(entity, primaryKey as never)
        if (owner) {
          validateOwnerHashes(ctx, owner as never)
        }
      }
    },
    log: (entity, _action, primaryKey, before, after) => ctx.logger.log(entity, LogAction.Update, primaryKey, before, after),
  })
  registerRealmWriteHooks(ctx.realm, {
    assertWritable: () => assertWritable(ctx),
    validate: (entity, item, patch) => {
      if (entity === 'File' && patch.Hash !== undefined)
        throw new Error('File.Hash is immutable; use db.files.put() and an owner editor')
      if ((entity === 'Skin' || entity === 'BeatmapSet' || entity === 'Score') && patch.Files !== undefined)
        throw new Error(`${entity}.Files is protected; use its owner editor`)
      if ((entity === 'Skin' || entity === 'BeatmapSet') && patch.Hash !== undefined) {
        const files = Reflect.get(item as object, 'Files')
        const expected = entity === 'Skin' ? computeSkinHash(ctx, files) : computeBeatmapSetHash(ctx, files)
        if (patch.Hash !== expected) throw new Error(`${entity}.Hash is derived from its files and cannot be assigned directly`)
      }
      if (entity === 'Beatmap' && patch.Hash !== undefined) {
        if (typeof patch.Hash !== 'string' || !/^[a-f0-9]{64}$/.test(patch.Hash) || (ctx.filesFolderPath && !ctx.fileStore?.verify(patch.Hash)))
          throw new Error('Beatmap.Hash must refer to a verified .osu blob')
      }
      if (entity === 'Score' && patch.Hash !== undefined) {
        const replay = [...((Reflect.get(item as object, 'Files') as Iterable<Record<string, unknown>> | undefined) ?? [])]
          .find(file => /\.osr$/i.test(String(file.Filename ?? '')))
        const replayFile = replay?.File as { Hash?: string } | undefined
        if (replayFile?.Hash !== patch.Hash) throw new Error('Score.Hash must match its replay file')
      }
    },
    snapshot: (entity, pk) => snapshot(ctx.realm, entity, pk),
    log: (entity, action, pk, before, after) => ctx.logger.log(entity, action === 'delete' ? LogAction.Delete : LogAction.Update, pk, before, after),
  })
  ctx.realm.addListener('change', () => ctx.queryGeneration.value++)
}
