import type Realm from 'realm'
import type { RollbackLogger } from './write/logger.js'
import type { FileStore } from './file-store.js'
import type { RealmSession } from './realm-session.js'
import type { ArchiveLimits } from './osz/import.js'
import type { FileStoreTransaction } from './file-store.js'
import { registerRealmEditHooks, registerRealmGeneration } from './get/base.js'
import { LogAction, snapshot } from './write/logger.js'
import type { BeatmapModule } from './beatmaps.js'
import type { ScoreModule } from './scores.js'
import type { BeatmapSetModule } from './sets.js'
import type { FileModule } from './files.js'
import type { RulesetModule } from './rulesets.js'
import type { RulesetSettingModule } from './rulesetsettings.js'
import type { SkinModule } from './skins.js'
import type { BeatmapMetadataModule } from './metadata.js'

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
}

/**
 * Returns `true` if a files folder path is configured.
 * @returns Whether filesFolderPath is configured.
 * @example
 * if (hasFilesFolder({ filesFolderPath: './files' })) {
 *   await db.skins.importOsk('skin.osk')
 * }
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
  return (ctx.realm as any).isInTransaction ? action() : ctx.realm.write(action)
}

/** Marks Realm writes so cached query snapshots can be refreshed. */
export function markChanged(ctx: OsuFilesContext): void {
  ctx.queryGeneration.value++
}

export function registerContextGeneration(ctx: OsuFilesContext): void {
  registerRealmGeneration(ctx.realm, () => ctx.queryGeneration.value, () => ctx.queryGeneration.value++)
  registerRealmEditHooks(ctx.realm, {
    snapshot,
    log: (entity, _action, primaryKey, before, after) => ctx.logger.log(entity, LogAction.Update, primaryKey, before, after),
  })
  ctx.realm.addListener('change', () => ctx.queryGeneration.value++)
}
