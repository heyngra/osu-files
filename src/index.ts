import Realm from 'realm'
import { Schema } from './schema/index.js'
import type { OsuFilesContext } from './context.js'
import { createBeatmapModule } from './beatmaps.js'
import { createScoreModule } from './scores.js'
import { createBeatmapSetModule } from './sets.js'
import { createCollectionModule } from './collections.js'
import { createRulesetModule } from './rulesets.js'
import { createSkinModule } from './skins.js'
import { createFileModule } from './files.js'
import { createKeyBindingModule } from './keybindings.js'
import { createModPresetModule } from './modpresets.js'
import { RollbackLogger, type ChangeLogEntry, type RollbackOptions } from './write/logger.js'

export * from './schema/index.js'
export type { OsuFilesContext }
export type { ChangeLogEntry, RollbackOptions }
export { hasFilesFolder } from './context.js'

export type InitOptions = {
  schemaVersion?: number
  readOnly?: boolean
  rollback?: RollbackOptions | false
  filesFolderPath?: string
  /** Every write checks, if hash is present in the files folder.*/
  checkHash?: boolean
}

export function init(path: string, options?: InitOptions) {
  const { schemaVersion = 51, readOnly = false, rollback: rb, filesFolderPath, checkHash } = options ?? {}
  const rollbackOpts: RollbackOptions = rb === undefined
    ? { enabled: !readOnly }
    : (rb === false ? { enabled: false } : { enabled: !readOnly, ...rb })

  const realm = new Realm({
    path,
    schema: Schema as Realm.ObjectSchema[],
    schemaVersion,
    readOnly,
  })

  const logger = new RollbackLogger(rollbackOpts)

  const ctx: OsuFilesContext = { realm, logger, filesFolderPath, checkHash }

  return {
    ctx,

    close() {
      logger.disable()
      realm.close()
    },

    rollback: {
      get entries(): readonly ChangeLogEntry[] { return logger.getEntries() },
      get enabled(): boolean { return logger.enabled },
      revert: () => logger.revert(),
      revertLast: () => logger.revertLast(),
      disable: () => logger.disable(),
    },

    beatmaps: createBeatmapModule(ctx),
    scores: createScoreModule(ctx),
    sets: createBeatmapSetModule(ctx),
    collections: createCollectionModule(ctx),
    rulesets: createRulesetModule(ctx),
    skins: createSkinModule(ctx),
    files: createFileModule(ctx),
    keybindings: createKeyBindingModule(ctx),
    modpresets: createModPresetModule(ctx),
  }
}
