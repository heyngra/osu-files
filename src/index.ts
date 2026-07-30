import { copyFileSync, existsSync, mkdirSync } from 'fs'
import Realm from 'realm'
import { basename, dirname, join } from 'path'
import { tmpdir } from 'os'
import { Schema } from './schema/index.js'
import type { OsuFilesContext } from './context.js'
import { registerContextGeneration } from './context.js'
import { createFileStore } from './file-store.js'
import { RealmSession } from './realm-session.js'
import { CURRENT_SCHEMA_VERSION, MIN_SCHEMA_VERSION } from './schema/version.js'
import { writeFileAtomic } from './util.js'
import { runMigrations, type MigrationReport, type MigrationEvent } from './migrations.js'
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
import type { ArchiveLimits } from './osz/import.js'
import { parseOsu } from './beatmap/parse.js'
import { serializeOsu } from './beatmap/serialize.js'
import type { OsuBeatmap } from './beatmap/types.js'
import type { Anchor, Vec2, StoryboardElementSource } from './beatmap/storyboard/types.js'
import { realmBeatmapToOsuBeatmap, realmSetToBeatmapSetData, saveOsuBeatmap, createFileRef } from './beatmap/migrate.js'
import { StoryboardSprite } from './beatmap/storyboard/elements.js'
import type { FileRef } from './types.js'
import { importOsr, parseOsr as parseOsrFile, type OsrImportOptions } from './osr/import.js'
import { exportOsr, toBuffer as exportOsrToBuffer } from './osr/export.js'
import { parseOsr as parseOsrBinary, computeReplayMD5 } from './osr/parse.js'
import type { ParsedReplay } from './osr/types.js'
import type { Score } from './schema/types.js'
import type { ImportedSkinData } from './skin/import.js'

export * from './schema/index.js'
export { RollbackEntry, type RollbackOptions }
export { FileStore } from './file-store.js'
export { EditSession } from './edit-session.js'
export { RealmSession, RealmClosedError, RealmReadOnlyError } from './realm-session.js'
export { CURRENT_SCHEMA_VERSION, MIN_SCHEMA_VERSION } from './schema/version.js'
export { type MigrationEvent, type MigrationReport } from './migrations.js'
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
export { FileRef } from './types.js'
export type { StoryboardLayerName, TriggerName, BlendingMode } from './beatmap/storyboard/types.js'
export type {
  OsuBeatmap, OsuGeneral, OsuEditor, OsuMetadata, OsuDifficulty,
  TimingPoint, OsuColour, OsuEvent, HitObject, HitCircle, HitSlider,
  HitSpinner, HitHold, SliderExtras, SampleSet, OverlayPosition,
} from './beatmap/types.js'
export { SliderCurveType } from './beatmap/types.js'
export type { RulesetShortName } from './keybindings/types.js'
export { createFileRef } from './beatmap/migrate.js'

export {
  Storyboard, StoryboardLayer, StoryboardSprite, StoryboardAnimation, StoryboardSample,
  StoryboardCommandGroup, StoryboardLoopingGroup, StoryboardTriggerGroup,
  StoryboardAlphaCommand, StoryboardXCommand, StoryboardYCommand,
  StoryboardScaleCommand, StoryboardVectorScaleCommand, StoryboardRotationCommand,
  StoryboardColourCommand, StoryboardFlipHCommand, StoryboardFlipVCommand, StoryboardBlendingCommand,
  Anchor, Easing, LoopType, CommandType,
  parseStoryboard, parseOsb, serializeStoryboard, serializeOsb,
} from './beatmap/storyboard/index.js'

/**
 * The full API object returned by {@link init}.
 * Every sub-module is scoped under its name; query methods are under `.get.`
 * (e.g. `db.scores.get.byDateAfter(someDate)`, `db.beatmaps.get.byId(id)`).
 */
export type OsuFilesAPI = {
  /** Guarded Realm access for advanced callers. */
  realm: RealmSession
  /** The report from the most recent Realm migration, if one ran. */
  migration?: MigrationReport
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
    /** Saves a modified beatmap back to disk and updates realm references. */
    save(beatmapId: string, beatmap: OsuBeatmap): boolean
    /** Create a FileRef with validation. Content auto-hashes. Hash checked against realm if available. */
    createFileRef(filename: string, source: { hash?: string; content?: Buffer }): FileRef
    /** Create a sprite from a validated file ref. */
    createSprite(fileRef: FileRef, origin?: Anchor, initialPosition?: Vec2, source?: StoryboardElementSource): StoryboardSprite
  }
}

/**
 * Options for {@link init}.
 * @example
 * init('client.realm', { readOnly: true, filesFolderPath: './files' })
 */
export type InitOptions = {
  /** @default CURRENT_SCHEMA_VERSION */
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
  /** Limits for untrusted archive input. */
  archiveLimits?: ArchiveLimits
  /** Realm migration options. */
  migration?: {
    /** Legacy collection database path. Defaults to a sibling collection.db. */
    legacyCollectionPath?: string
    /** Keep a pre-migration copy under the system temporary directory. @default true */
    backup?: boolean
    /** Receives migration progress and warning events. */
    onEvent?: (event: MigrationEvent) => void
  }
}
/**
 * Opens an osu!lazer client.realm database.
 *
 * @param path - Path to client.realm.
 * @param options - Configuration options.
 * @returns The osu-files API object with close(), logger, and all sub-modules.
 * @example
 * const db = init('./client.realm', { filesFolderPath: './files' })
 * const sets = db.sets.get
 * const rawRealm = db.realm.raw
 * db.close()
 */
export function init(path: string, options?: InitOptions): OsuFilesAPI {
  const {
    schemaVersion = CURRENT_SCHEMA_VERSION,
    readOnly = false,
    rollback: rb,
    filesFolderPath,
    checkHash,
    queryCache = true,
    archiveLimits,
    migration: migrationOptions,
  } = options ?? {}
  if (schemaVersion < MIN_SCHEMA_VERSION)
    throw new Error(`[osu-files] Schema version ${schemaVersion} is older than supported version ${MIN_SCHEMA_VERSION}`)
  if (schemaVersion > CURRENT_SCHEMA_VERSION)
    throw new Error(`[osu-files] Schema version ${schemaVersion} is newer than supported version ${CURRENT_SCHEMA_VERSION}`)

  const rollbackOpts: RollbackOptions = rb === undefined
    ? { enabled: !readOnly }
    : (rb === false ? { enabled: false } : { enabled: !readOnly, ...rb, ...(readOnly ? { enabled: false } : {}) })

  const migrationEvents: MigrationEvent[] = []
  let migrationReport: MigrationReport | undefined
  const previousVersion = getSchemaVersion(path)
  if (!readOnly && migrationOptions?.backup !== false && previousVersion !== undefined && previousVersion < schemaVersion)
    createMigrationBackup(path)

  const realm = new Realm({
    path,
    schema: Schema as Realm.ObjectSchema[],
    schemaVersion,
    readOnly,
    onMigration: readOnly ? undefined : (oldRealm, newRealm) => {
      migrationReport = runMigrations(oldRealm, newRealm, {
        filesFolderPath,
        legacyCollectionPath: migrationOptions?.legacyCollectionPath ?? join(dirname(path), 'collection.db'),
        events: migrationEvents,
        onEvent: migrationOptions?.onEvent,
      })
    },
  })

  const logger = new RollbackLogger(rollbackOpts, realm, getConfig)
  const queryGeneration = { value: 0 }
  const session = new RealmSession(realm, readOnly, () => queryGeneration.value++)
  const fileStore = createFileStore(filesFolderPath, readOnly)

  const ctx = { realm, session, logger, fileStore, readOnly, archiveLimits, filesFolderPath, checkHash, queryCache, queryGeneration } as OsuFilesContext
  registerContextGeneration(ctx)

  const beatmaps = createBeatmapModule(ctx)
  const scores = createScoreModule(ctx)
  const files = createFileModule(ctx)
  ctx.files = files
  const rulesets = createRulesetModule(ctx)
  const rulesetSettings = createRulesetSettingModule(ctx)
  const skins = createSkinModule(ctx)
  const sets = createBeatmapSetModule(ctx)
  const metadata = createBeatmapMetadataModule(ctx)
  ctx.beatmaps = beatmaps
  ctx.scores = scores
  ctx.rulesets = rulesets
  ctx.rulesetSettings = rulesetSettings
  ctx.skins = skins
  ctx.sets = sets
  ctx.metadata = metadata

  return {
    /** Guarded Realm access for advanced callers. */
    realm: session,
    /** The report from the most recent Realm migration, if one ran. */
    migration: migrationReport,

    /** Closes the Realm connection and disables rollback logging. */
    close() {
      logger.disable()
      session.close()
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
        writeFileAtomic(outputPath, buf)
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
      /** Saves a modified beatmap back to disk and updates realm references. */
      save: (beatmapId: string, beatmap: OsuBeatmap) => saveOsuBeatmap(ctx, beatmapId, beatmap),
      /** Create a FileRef with validation. Content auto-hashes. Hash checked against realm if available. */
      createFileRef: (filename: string, source: { hash?: string; content?: Buffer }) =>
        createFileRef(filename, source, ctx),
      /** Create a sprite from a validated file ref. */
      createSprite: (fileRef: FileRef, origin?: Anchor, initialPosition?: Vec2, source?: StoryboardElementSource) =>
        new StoryboardSprite(fileRef, origin, initialPosition, source),
    },
  }
}

function getSchemaVersion(path: string): number | undefined {
  if (!existsSync(path)) return undefined
  try { return Realm.schemaVersion(path) } catch { return undefined }
}

function createMigrationBackup(path: string): void {
  const directory = join(tmpdir(), 'osu-files', 'migrations')
  mkdirSync(directory, { recursive: true })
  const destination = join(directory, `${basename(path)}.${process.pid}.${Date.now()}.realm`)
  copyFileSync(path, destination)
}

export default init;
