import type Realm from 'realm'
import type { RollbackLogger } from './write/logger.js'
import type { BeatmapModule } from './beatmaps.js'
import type { ScoreModule } from './scores.js'
import type { BeatmapSetModule } from './sets.js'
import type { FileModule } from './files.js'
import type { RulesetModule } from './rulesets.js'
import type { SkinModule } from './skins.js'
import type { BeatmapMetadataModule } from './metadata.js'

/**
 * Shared context passed to all modules.
 * @example
 * const ctx: OsuFilesContext = db.ctx
 * if (hasFilesFolder(ctx)) { ... }
 */
export type OsuFilesContext = {
  realm: Realm
  logger: RollbackLogger
  filesFolderPath?: string
  checkHash?: boolean
  beatmaps: BeatmapModule
  scores: ScoreModule
  sets: BeatmapSetModule
  files: FileModule
  rulesets: RulesetModule
  skins: SkinModule
  metadata: BeatmapMetadataModule
}

/**
 * Returns `true` if a files folder path is configured.
 * @returns Whether filesFolderPath is configured.
 * @example
 * if (hasFilesFolder(db.ctx)) {
 *   await db.skins.importOsk('skin.osk')
 * }
 */
export function hasFilesFolder(ctx: OsuFilesContext): boolean {
  return !!ctx.filesFolderPath
}
