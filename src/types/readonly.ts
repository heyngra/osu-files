import type { BSON } from 'realm'
import type {
  Beatmap,
  BeatmapCollection,
  BeatmapMetadata,
  BeatmapSet,
  File,
  KeyBinding,
  ModPreset,
  RealmFile,
  Ruleset,
  RulesetSetting,
  Score,
  Skin,
} from '../schema/types.js'

type Primitive = string | number | boolean | bigint | symbol | null | undefined
type Atomic = Primitive | Function | Buffer | Date | BSON.UUID

export type DeepReadonly<T> =
  T extends Atomic ? T :
  T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } :
  T

export type DeepMutable<T> =
  T extends Atomic ? T :
  T extends readonly (infer U)[] ? DeepMutable<U>[] :
  T extends object ? { -readonly [K in keyof T]: DeepMutable<T[K]> } :
  T

export type SkinSnapshot = DeepReadonly<Skin>
export type BeatmapSnapshot = DeepReadonly<Beatmap>
export type BeatmapSetSnapshot = DeepReadonly<BeatmapSet>
export type CollectionSnapshot = DeepReadonly<BeatmapCollection>
export type ScoreSnapshot = DeepReadonly<Score>
export type FileSnapshot = DeepReadonly<RealmFile>
export type KeyBindingSnapshot = DeepReadonly<KeyBinding>
export type ModPresetSnapshot = DeepReadonly<ModPreset>
export type RulesetSnapshot = DeepReadonly<Ruleset>
export type RulesetSettingSnapshot = DeepReadonly<RulesetSetting>
export type BeatmapMetadataSnapshot = DeepReadonly<BeatmapMetadata>

export type BeatmapEdit = DeepMutable<Beatmap>
export type BeatmapSetEdit = DeepMutable<BeatmapSet>
export type CollectionEdit = DeepMutable<BeatmapCollection>
export type ScoreEdit = DeepMutable<Score>
export type SkinEdit = DeepMutable<Skin>
export type FileEdit = DeepMutable<File>
export type KeyBindingEdit = DeepMutable<KeyBinding>
export type ModPresetEdit = DeepMutable<ModPreset>
export type RulesetEdit = DeepMutable<Ruleset>
