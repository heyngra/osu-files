import Realm from 'realm'
import { Schema } from './schema/index.js'
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

export type { ChangeLogEntry, RollbackOptions }

export type InitOptions = {
  schemaVersion?: number
  readOnly?: boolean
  rollback?: RollbackOptions | false
}

export function init(path: string, options?: InitOptions) {
  const { schemaVersion = 51, readOnly = false, rollback: rb } = options ?? {}
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

  return {
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

    beatmaps: createBeatmapModule(realm, logger),
    scores: createScoreModule(realm, logger),
    sets: createBeatmapSetModule(realm, logger),
    collections: createCollectionModule(realm, logger),
    rulesets: createRulesetModule(realm, logger),
    skins: createSkinModule(realm, logger),
    files: createFileModule(realm, logger),
    keybindings: createKeyBindingModule(realm, logger),
    modpresets: createModPresetModule(realm, logger),
  }
}
