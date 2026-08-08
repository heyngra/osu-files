import type Realm from 'realm'
import type { EditSession } from '../edit-session.js'
import type {
  Beatmap,
  BeatmapCollection,
  BeatmapSet,
  KeyBinding,
  ModPreset,
  Ruleset,
  Score,
  Skin,
} from '../schema/types.js'
import type {
  BeatmapEdit,
  BeatmapSetEdit,
  BeatmapSetSnapshot,
  BeatmapMetadataSnapshot,
  BeatmapSnapshot,
  CollectionEdit,
  CollectionSnapshot,
  DeepMutable,
  FileEdit,
  FileSnapshot,
  KeyBindingEdit,
  KeyBindingSnapshot,
  ModPresetEdit,
  ModPresetSnapshot,
  RulesetEdit,
  RulesetSnapshot,
  RulesetSettingSnapshot,
  ScoreSnapshot,
  ScoreEdit,
  SkinSnapshot,
  SkinEdit,
} from '../types/readonly.js'

/** Batch changes for every item in a result. */
export type BatchWrite<Patch> = {
  /** Deletes every matched entity in one transaction. */
  delete(): number
  /** Applies one typed patch to every matched entity in one transaction. */
  update(patch: Patch): number
}

/** Array methods and result operations available on every result. */
export interface ResultFacade<T, Self> extends ReadonlyArray<T> {
  /** Limits how many values array operations can return. */
  limit(n: number): Self
  /** Counts matches before applying `limit()`. */
  count(): number
  /** Returns the first matching snapshot, or `undefined`. */
  first(): T | undefined
  /** Returns all matching snapshots as a regular array. */
  toArray(): readonly T[]
  /** Alias for {@link toArray}. */
  all(): readonly T[]
  /** Sorts results by a Realm field. */
  sortedBy(field: string, ascending?: boolean): Self
}

/** Write operations available on writable results. */
export interface EditableResultFacade<T, Self, Patch, Editable = DeepMutable<T>> extends ResultFacade<T, Self> {
  /** Saves the current edit session, if there is one. */
  commit(): void
  /** Drops the current edit session's changes, if there is one. */
  rollback(): void
  /**
   * Starts a buffered edit session for the matching values.
   *
   * @example
   * using session = db.beatmaps.get.byHidden(false).autoEdit()
   * for (const beatmap of session)
   *   beatmap.Hidden = true
   * // Commits automatically when the scope ends.
   */
  autoEdit(): EditSession<Editable>
  /** Applies batch operations to the matching values. */
  readonly write: BatchWrite<Patch>
}

export type BeatmapPatch = Partial<Omit<Beatmap, 'ID' | 'Hash' | 'MD5Hash'>>
export type BeatmapSetPatch = Partial<Omit<BeatmapSet, 'ID' | 'Hash' | 'Files'>>
export type CollectionPatch = Partial<Omit<BeatmapCollection, 'ID'>>
export type ScorePatch = Partial<Omit<Score, 'ID' | 'Hash' | 'Files'>>
export type SkinPatch = Partial<Omit<Skin, 'ID' | 'Hash' | 'Files'>>
export type FilePatch = never
export type KeyBindingPatch = Partial<Omit<KeyBinding, 'ID'>>
export type ModPresetPatch = Partial<Omit<ModPreset, 'ID'>>
export type RulesetPatch = Partial<Omit<Ruleset, 'ShortName'>>

export type Beatmaps = EditableResultFacade<BeatmapSnapshot, Beatmaps, BeatmapPatch, BeatmapEdit> & {
  byId(value: string | Realm.BSON.UUID): Beatmaps
  byBpmAbove(value: number): Beatmaps
  byBpmBelow(value: number): Beatmaps
  byBpmBetween(low: number, high: number): Beatmaps
  byStarRatingAbove(value: number): Beatmaps
  byStarRatingBelow(value: number): Beatmaps
  byStarRatingBetween(low: number, high: number): Beatmaps
  byLengthAbove(value: number): Beatmaps
  byLengthBelow(value: number): Beatmaps
  byLengthBetween(low: number, high: number): Beatmaps
  byBeatDivisor(value: number): Beatmaps
  byOnlineId(value: number): Beatmaps
  byStatus(value: number): Beatmaps
  byTotalObjectCountAbove(value: number): Beatmaps
  byTotalObjectCountBelow(value: number): Beatmaps
  byEndTimeObjectCountAbove(value: number): Beatmaps
  byEndTimeObjectCountBelow(value: number): Beatmaps
  byDifficultyName(value: string): Beatmaps
  byDifficultyNameContains(value: string): Beatmaps
  byHash(value: string): Beatmaps
  byMd5(value: string): Beatmaps
  byHidden(value: boolean): Beatmaps
  byLastPlayedBefore(value: Date): Beatmaps
  byLastPlayedAfter(value: Date): Beatmaps
  byLastLocalUpdateBefore(value: Date): Beatmaps
  byLastLocalUpdateAfter(value: Date): Beatmaps
  byLastOnlineUpdateBefore(value: Date): Beatmaps
  byLastOnlineUpdateAfter(value: Date): Beatmaps
  bySetId(value: string | Realm.BSON.UUID): Beatmaps
  bySetOnlineId(value: number): Beatmaps
  byRuleset(value: string): Beatmaps
  byTitle(value: string): Beatmaps
  byTitleContains(value: string): Beatmaps
  byArtist(value: string): Beatmaps
  byArtistContains(value: string): Beatmaps
  byAuthorContains(value: string): Beatmaps
  byAuthorOnlineId(value: number): Beatmaps
}

export type Sets = EditableResultFacade<BeatmapSetSnapshot, Sets, BeatmapSetPatch, BeatmapSetEdit> & {
  byId(value: string | Realm.BSON.UUID): Sets
  byOnlineId(value: number): Sets
  byStatus(value: number): Sets
  byHash(value: string): Sets
  byDeletePending(value: boolean): Sets
  byProtected(value: boolean): Sets
  byDateAddedBefore(value: Date): Sets
  byDateAddedAfter(value: Date): Sets
  byDateSubmittedBefore(value: Date): Sets
  byDateSubmittedAfter(value: Date): Sets
  byDateRankedBefore(value: Date): Sets
  byDateRankedAfter(value: Date): Sets
  byBeatmapMd5(value: string): Sets
  byBeatmapOnlineId(value: number): Sets
  withFile(value: string): Sets
}

export type Scores = EditableResultFacade<ScoreSnapshot, Scores, ScorePatch, ScoreEdit> & {
  byId(value: string | Realm.BSON.UUID): Scores
  byTotalScoreAbove(value: number): Scores
  byTotalScoreBelow(value: number): Scores
  byMaxComboAbove(value: number): Scores
  byMaxComboBelow(value: number): Scores
  byAccuracyAbove(value: number): Scores
  byAccuracyBelow(value: number): Scores
  byComboAbove(value: number): Scores
  byComboBelow(value: number): Scores
  byOnlineId(value: number): Scores
  byLegacyOnlineId(value: number): Scores
  byRank(value: number): Scores
  byRankAbove(value: number): Scores
  byClientVersion(value: string): Scores
  byModsContains(value: string): Scores
  byDateBefore(value: Date): Scores
  byDateAfter(value: Date): Scores
  byDeletePending(value: boolean): Scores
  byIsLegacyScore(value: boolean): Scores
  byBackgroundReprocessingFailed(value: boolean): Scores
  byBeatmapId(value: string | Realm.BSON.UUID): Scores
  byBeatmapOnlineId(value: number): Scores
  byBeatmapMd5(value: string): Scores
  byBeatmapSetOnlineId(value: number): Scores
  byUserId(value: number): Scores
  byUsernameContains(value: string): Scores
  byUserCountryCode(value: string): Scores
  byRuleset(value: string): Scores
  byPpAbove(value: number): Scores
}

export type Collections = EditableResultFacade<CollectionSnapshot, Collections, CollectionPatch, CollectionEdit> & {
  byId(value: string | Realm.BSON.UUID): Collections
  byName(value: string): Collections
  byNameContains(value: string): Collections
  byLastModifiedBefore(value: Date): Collections
  byLastModifiedAfter(value: Date): Collections
  withBeatmap(value: string): Collections
  sortedByName(ascending?: boolean): Collections
  sortedByLastModified(ascending?: boolean): Collections
}

export type Rulesets = EditableResultFacade<RulesetSnapshot, Rulesets, RulesetPatch, RulesetEdit> & {
  byShortName(value: string): Rulesets
  byOnlineId(value: number): Rulesets
  byName(value: string): Rulesets
  byNameContains(value: string): Rulesets
  byAvailable(value: boolean): Rulesets
}

export type RulesetSettings = ResultFacade<RulesetSettingSnapshot, RulesetSettings> & {
  byRulesetName(value: string): RulesetSettings
  byVariant(value: number): RulesetSettings
  byKey(value: string): RulesetSettings
  byKeyContains(value: string): RulesetSettings
  byValue(value: string): RulesetSettings
  byValueContains(value: string): RulesetSettings
}

export type Skins = EditableResultFacade<SkinSnapshot, Skins, SkinPatch, SkinEdit> & {
  byId(value: string | Realm.BSON.UUID): Skins
  byName(value: string): Skins
  byNameContains(value: string): Skins
  byCreatorContains(value: string): Skins
  byHash(value: string): Skins
  byInstantiationInfoContains(value: string): Skins
  byProtected(value: boolean): Skins
  byDeletePending(value: boolean): Skins
  withFile(value: string): Skins
  usable(): readonly SkinSnapshot[]
  builtIn(): readonly SkinSnapshot[]
  user(): readonly SkinSnapshot[]
}

export type Files = EditableResultFacade<FileSnapshot, Files, FilePatch, FileEdit> & {
  byHash(value: string): Files
}

export type Keybindings = EditableResultFacade<KeyBindingSnapshot, Keybindings, KeyBindingPatch, KeyBindingEdit> & {
  byId(value: string | Realm.BSON.UUID): Keybindings
  byRulesetName(value: string): Keybindings
  byAction(value: number): Keybindings
  byVariant(value: number): Keybindings
}

export type ModPresets = EditableResultFacade<ModPresetSnapshot, ModPresets, ModPresetPatch, ModPresetEdit> & {
  byId(value: string | Realm.BSON.UUID): ModPresets
  byName(value: string): ModPresets
  byNameContains(value: string): ModPresets
  byDescriptionContains(value: string): ModPresets
  byModsContains(value: string): ModPresets
  byDeletePending(value: boolean): ModPresets
  byRuleset(value: string): ModPresets
}

export type Metadata = ResultFacade<BeatmapMetadataSnapshot, Metadata> & {
  byTitle(value: string): Metadata
  byTitleContains(value: string): Metadata
  byTitleUnicode(value: string): Metadata
  byTitleUnicodeContains(value: string): Metadata
  byArtist(value: string): Metadata
  byArtistContains(value: string): Metadata
  byArtistUnicode(value: string): Metadata
  byArtistUnicodeContains(value: string): Metadata
  bySource(value: string): Metadata
  bySourceContains(value: string): Metadata
  byTagsContains(value: string): Metadata
  byAudioFile(value: string): Metadata
  byBackgroundFile(value: string): Metadata
  byPreviewTimeAbove(value: number): Metadata
  byPreviewTimeBelow(value: number): Metadata
  byAuthorUsernameContains(value: string): Metadata
  byAuthorOnlineId(value: number): Metadata
}
