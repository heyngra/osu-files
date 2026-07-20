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
import { importOsz } from './osz/import.js'
import { exportOsz, exportOszFromData } from './osz/export.js'
import { parseOsu } from './beatmap/parse.js'
import { serializeOsu } from './beatmap/serialize.js'
import { realmBeatmapToOsuBeatmap, realmSetToBeatmapSetData } from './beatmap/migrate.js'

export * from './schema/index.js'
export type { OsuFilesContext }
export type { ChangeLogEntry, RollbackOptions }
export { hasFilesFolder } from './context.js'

export type { BeatmapSetData, BeatmapSetFile } from './osz/types.js'
export type {
  OsuBeatmap, OsuGeneral, OsuEditor, OsuMetadata, OsuDifficulty,
  TimingPoint, OsuColour, OsuEvent, HitObject, HitCircle, HitSlider,
  HitSpinner, HitHold, SliderExtras, SliderCurveType,
} from './beatmap/types.js'

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

    osz: {
      import: (filePath: string) => importOsz(ctx, filePath),
      export: (setID: string, outputPath: string, options?: { beatmaps?: import('./beatmap/types.js').OsuBeatmap[] }) =>
        exportOsz(ctx, setID, outputPath, options),
      exportFromData: (data: import('./osz/types.js').BeatmapSetData, outputPath: string) =>
        exportOszFromData(ctx, data, outputPath),
    },

    beatmap: {
      parse: (content: string) => parseOsu(content),
      serialize: (beatmap: import('./beatmap/types.js').OsuBeatmap) => serializeOsu(beatmap),
      getFullData: (beatmapId: string) => realmBeatmapToOsuBeatmap(ctx, beatmapId),
      getFullDataSet: (setId: string) => realmSetToBeatmapSetData(ctx, setId),
    },
  }
}
