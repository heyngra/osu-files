import { writeFileSync } from 'fs'
import Realm from 'realm'
import { Schema } from './schema/index.js'
import type { OsuFilesContext } from './context.js'
import type { BeatmapModule } from './beatmaps.js'
import type { ScoreModule } from './scores.js'
import type { BeatmapSetModule } from './sets.js'
import type { BeatmapCollectionModule } from './collections.js'
import type { RulesetModule } from './rulesets.js'
import type { RulesetSettingModule } from './rulesetsettings.js'
import type { SkinModule } from './skins.js'
import type { FileModule } from './files.js'
import type { KeyBindingModule } from './keybindings.js'
import type { ModPresetModule } from './modpresets.js'
import type { BeatmapMetadataModule } from './metadata.js'
import { createBeatmapModule } from './beatmaps.js'
import { createScoreModule } from './scores.js'
import { createBeatmapSetModule } from './sets.js'
import { createCollectionModule } from './collections.js'
import { createRulesetModule } from './rulesets.js'
import { createRulesetSettingModule } from './rulesetsettings.js'
import { createSkinModule } from './skins.js'
import { createFileModule } from './files.js'
import { createKeyBindingModule } from './keybindings.js'
import { createModPresetModule } from './modpresets.js'
import { createBeatmapMetadataModule } from './metadata.js'
import { RollbackLogger, RollbackEntry, type RollbackOptions } from './write/logger.js'
import { getConfig } from './write/factory.js'
import { importOsz } from './osz/import.js'
import { exportOsz, exportOszFromData } from './osz/export.js'
import type { BeatmapSetData } from './osz/types.js'
import { parseOsu } from './beatmap/parse.js'
import { serializeOsu } from './beatmap/serialize.js'
import type { OsuBeatmap } from './beatmap/types.js'
import { realmBeatmapToOsuBeatmap, realmSetToBeatmapSetData } from './beatmap/migrate.js'
import { importOsr, parseOsr as parseOsrFile, type OsrImportOptions } from './osr/import.js'
import { exportOsr, toBuffer as exportOsrToBuffer } from './osr/export.js'
import { parseOsr as parseOsrBinary, computeReplayMD5 } from './osr/parse.js'
import type { ParsedReplay } from './osr/types.js'
import type { Score } from './schema/types.js'
import type { ImportedSkinData } from './skin/import.js'

export * from './schema/index.js'
export type { OsuFilesContext }
export { RollbackEntry, type RollbackOptions }
export { hasFilesFolder } from './context.js'
export { BUILT_IN_SKINS, BUILT_IN_SKIN_IDS, BUILT_IN_SKIN_ORDER } from './skin/constants.js'
export type { ImportedSkinData } from './skin/import.js'
export { parseSkinIni } from './skin/skin-ini.js'
export type { SkinIni, SkinIniGeneral, SkinIniColours, SkinIniFonts, SkinIniCatchTheBeat, SkinIniMania, SkinIniColour } from './skin/skin-ini.js'

export type { KeyBindingDef } from './keybindings/types.js'
export { GlobalAction, OsuAction, TaikoAction, CatchAction, ManiaAction, RulesetAction, RulesetName, RulesetOnlineID } from './keybindings/types.js'
export { GLOBAL_DEFAULTS, OSU_DEFAULTS, TAIKO_DEFAULTS, CATCH_DEFAULTS, getManiaDefaults } from './keybindings/defaults.js'
export { InputKey } from './keybindings/keys.js'

export type { BeatmapSetData, BeatmapSetFile } from './osz/types.js'
export type {
  OsuBeatmap, OsuGeneral, OsuEditor, OsuMetadata, OsuDifficulty,
  TimingPoint, OsuColour, OsuEvent, HitObject, HitCircle, HitSlider,
  HitSpinner, HitHold, SliderExtras,
} from './beatmap/types.js'
export { SliderCurveType } from './beatmap/types.js'

/**
 * The full API object returned by {@link init}.
 * Every sub-module is scoped under its name; query methods are under `.get.`
 * (e.g. `db.scores.get.recent(10)`, `db.beatmaps.get.byId(id)`).
 */
export type OsuFilesAPI = {
  /** The shared context with realm, logger, and all modules. */
  ctx: OsuFilesContext
  /** Closes the Realm connection and disables rollback logging. */
  close(): void
  /** Rollback logger for inspecting and reverting write operations. */
  logger: RollbackLogger
  /** Beatmap module for querying, creating, updating, and deleting beatmaps. */
  beatmaps: BeatmapModule
  /** Score module for querying, creating, updating, and deleting scores. */
  scores: ScoreModule
  /** Beatmap set module for querying, creating, updating, deleting, and importing sets. */
  sets: BeatmapSetModule
  /** Beatmap collection module for querying and writing collections. */
  collections: BeatmapCollectionModule
  /** Ruleset module for querying rulesets (osu!, taiko, fruits, mania). */
  rulesets: RulesetModule
  /** Ruleset setting module for querying ruleset settings. */
  rulesetSettings: RulesetSettingModule
  /** Skin module for querying, writing, importing, exporting, and managing skins. */
  skins: SkinModule
  /** File module for querying files and cleaning up orphans. */
  files: FileModule
  /** Key binding module for querying and writing key bindings. */
  keybindings: KeyBindingModule
  /** Mod preset module for querying and writing mod presets. */
  modpresets: ModPresetModule
  /** Beatmap metadata module for querying and writing metadata. */
  metadata: BeatmapMetadataModule
  /** .osz beatmap archive operations. */
  osz: {
    /** Imports an .osz file into the Realm database. */
    import(filePath: string): Promise<BeatmapSetData>
    /** Exports a beatmap set to an .osz file. */
    export(setID: string, outputPath: string, options?: { beatmaps?: OsuBeatmap[] }): Promise<void>
    /** Exports BeatmapSetData directly to an .osz file. */
    exportFromData(data: BeatmapSetData, outputPath: string): Promise<void>
  }
  /** .osr replay operations. */
  osr: {
    /** Imports an .osr replay into the Realm database. */
    import(filePath: string, options?: OsrImportOptions): ParsedReplay
    /** Exports a score to an .osr replay file. */
    export(scoreId: string, outputPath: string): void
    /** Parses an .osr replay buffer without importing. */
    parse(buffer: Buffer): ParsedReplay
    /** Parses an .osr replay file into a Score object without writing to realm. */
    parseOsr(filePath: string, options?: OsrImportOptions): Score
    /** Serialises a Score into an .osr replay buffer without writing to disk. */
    toBuffer(score: Score): Buffer
    /** Computes an MD5 hash for matching lazer replays by username and timestamp. */
    computeReplayMD5(username: string, timestamp: Date): string
  }
  /** .osk skin archive operations. */
  osk: {
    /** Imports an .osk skin into the Realm database. */
    import(filePath: string): Promise<ImportedSkinData>
    /** Exports a skin to an .osk file on disk. */
    export(skinId: string, outputPath: string): Promise<void>
  }
  /** .osu beatmap file operations (parse, serialize, extract from realm). */
  beatmap: {
    /** Parses an .osu file content string into structured beatmap data. */
    parse(content: string): OsuBeatmap
    /** Serializes beatmap data back to an .osu file content string. */
    serialize(beatmap: OsuBeatmap): string
    /** Reads a beatmap's .osu file from the files folder and parses it. */
    getFullData(beatmapId: string): OsuBeatmap | undefined
    /** Reads all beatmaps in a set from the files folder and parses them. */
    getFullDataSet(setId: string): BeatmapSetData | undefined
  }
}

/**
 * Options for {@link init}.
 * @example
 * init('client.realm', { readOnly: true, filesFolderPath: './files' })
 */
export type InitOptions = {
  /** @default 51 */
  schemaVersion?: number
  /** @default false */
  readOnly?: boolean
  /** @default { enabled: true } */
  rollback?: RollbackOptions | false
  /** @example './files' */
  filesFolderPath?: string
  /** Every write checks if hash is present in the files folder. */
  checkHash?: boolean
  /** Cache query results in memory across repeated accesses on the same query object. @default true */
  queryCache?: boolean
}
/**
 * Opens an osu!lazer client.realm database.
 *
 * @param path - Path to client.realm.
 * @param options - Configuration options.
 * @returns The osu-files API object with close(), rollback, and all sub-modules.
 * @example
 * const db = init('./client.realm', { filesFolderPath: './files' })
 * const sets = db.sets.get
 * db.close()
 */
export function init(path: string, options?: InitOptions): OsuFilesAPI {
  const { schemaVersion = 51, readOnly = false, rollback: rb, filesFolderPath, checkHash, queryCache = true } = options ?? {}
  const rollbackOpts: RollbackOptions = rb === undefined
    ? { enabled: !readOnly }
    : (rb === false ? { enabled: false } : { enabled: !readOnly, ...rb })

  const realm = new Realm({
    path,
    schema: Schema as Realm.ObjectSchema[],
    schemaVersion,
    readOnly,
  })

  const logger = new RollbackLogger(rollbackOpts, realm, getConfig)

  const ctx = { realm, logger, filesFolderPath, checkHash, queryCache } as OsuFilesContext

  const beatmaps = createBeatmapModule(ctx)
  const scores = createScoreModule(ctx)
  const files = createFileModule(ctx)
  const rulesets = createRulesetModule(ctx)
  const rulesetSettings = createRulesetSettingModule(ctx)
  const skins = createSkinModule(ctx)
  const sets = createBeatmapSetModule(ctx)
  const metadata = createBeatmapMetadataModule(ctx)
  ctx.beatmaps = beatmaps
  ctx.scores = scores
  ctx.files = files
  ctx.rulesets = rulesets
  ctx.rulesetSettings = rulesetSettings
  ctx.skins = skins
  ctx.sets = sets
  ctx.metadata = metadata

  return {
    /** The shared context with realm, logger, and all modules. */
    ctx,

    /** Closes the Realm connection and disables rollback logging. */
    close() {
      logger.disable()
      realm.close()
    },

    /** Rollback logger for inspecting and reverting write operations. */
    logger,

    /** Beatmap module for querying, creating, updating, and deleting beatmaps. */
    beatmaps,
    /** Score module for querying, creating, updating, and deleting scores. */
    scores,
    /** Beatmap set module for querying, creating, updating, deleting, and importing sets. */
    sets,
    /** Beatmap collection module for querying and writing collections. */
    collections: createCollectionModule(ctx),
    /** Ruleset module for querying rulesets (osu!, taiko, fruits, mania). */
    rulesets,
    /** Ruleset setting module for querying ruleset settings. */
    rulesetSettings,
    /** Skin module for querying, writing, importing, exporting, and managing skins. */
    skins,
    /** File module for querying files and cleaning up orphans. */
    files,
    /** Key binding module for querying and writing key bindings. */
    keybindings: createKeyBindingModule(ctx),
    /** Mod preset module for querying and writing mod presets. */
    modpresets: createModPresetModule(ctx),
    /** Beatmap metadata module for querying and writing metadata. */
    metadata,

    /** .osz beatmap archive operations. */
    osz: {
      /** Imports an .osz file into the Realm database. */
      import: (filePath: string) => importOsz(ctx, filePath),
      /** Exports a beatmap set to an .osz file. */
      export: (setID: string, outputPath: string, options?: { beatmaps?: OsuBeatmap[] }) =>
        exportOsz(ctx, setID, outputPath, options),
      /** Exports BeatmapSetData directly to an .osz file. */
      exportFromData: (data: BeatmapSetData, outputPath: string) =>
        exportOszFromData(ctx, data, outputPath),
    },

    /** .osr replay operations. */
    osr: {
      /** Imports an .osr replay into the Realm database. */
      import: (filePath: string, options?: OsrImportOptions) => importOsr(ctx, filePath, options),
      /** Exports a score to an .osr replay file. */
      export: (scoreId: string, outputPath: string) => exportOsr(ctx, scoreId, outputPath),
      /** Parses an .osr replay buffer without importing. */
      parse: (buffer: Buffer) => parseOsrBinary(buffer),
      /** Parses an .osr replay file into a Score object without writing to realm. */
      parseOsr: (filePath: string, options?: OsrImportOptions) => parseOsrFile(ctx, filePath, options),
    /** Serialises a Score into an .osr replay buffer without writing to disk. */
    toBuffer: (score: Score) => exportOsrToBuffer(ctx, score),
      /** Computes an MD5 hash for matching lazer replays by username and timestamp. */
      computeReplayMD5,
    },

    /** .osk skin archive operations. */
    osk: {
      /** Imports an .osk skin into the Realm database. */
      import: (filePath: string) => skins.importOsk(filePath),
      /** Exports a skin to an .osk file on disk. */
      export: async (skinId: string, outputPath: string) => {
        const buf = await skins.exportOsk(skinId)
        writeFileSync(outputPath, buf)
      },
    },

    /** .osu beatmap file operations (parse, serialize, extract from realm). */
    beatmap: {
      /** Parses an .osu file content string into structured beatmap data. */
      parse: (content: string) => parseOsu(content),
      /** Serializes beatmap data back to an .osu file content string. */
      serialize: (beatmap: OsuBeatmap) => serializeOsu(beatmap),
      /** Reads a beatmap's .osu file from the files folder and parses it. */
      getFullData: (beatmapId: string) => realmBeatmapToOsuBeatmap(ctx, beatmapId),
      /** Reads all beatmaps in a set from the files folder and parses them. */
      getFullDataSet: (setId: string) => realmSetToBeatmapSetData(ctx, setId),
    },
  }
}

export default init;
