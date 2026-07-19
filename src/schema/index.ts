export type { Beatmap } from './Beatmap.js'
export { BeatmapSchema } from './Beatmap.js'
export type { BeatmapCollection } from './BeatmapCollection.js'
export { BeatmapCollectionSchema } from './BeatmapCollection.js'
export type { BeatmapDifficulty } from './BeatmapDifficulty.js'
export { BeatmapDifficultySchema } from './BeatmapDifficulty.js'
export type { BeatmapMetadata } from './BeatmapMetadata.js'
export { BeatmapMetadataSchema } from './BeatmapMetadata.js'
export type { BeatmapSet } from './BeatmapSet.js'
export { BeatmapSetSchema } from './BeatmapSet.js'
export type { BeatmapUserSettings } from './BeatmapUserSettings.js'
export { BeatmapUserSettingsSchema } from './BeatmapUserSettings.js'
export type { File } from './RealmFile.js'
export { FileSchema } from './RealmFile.js'
export type { KeyBinding } from './KeyBinding.js'
export { KeyBindingSchema } from './KeyBinding.js'
export type { ModPreset } from './ModPreset.js'
export { ModPresetSchema } from './ModPreset.js'
export type { RealmNamedFileUsage } from './RealmNamedFileUsage.js'
export { RealmNamedFileUsageSchema } from './RealmNamedFileUsage.js'
export type { RealmUser } from './RealmUser.js'
export { RealmUserSchema } from './RealmUser.js'
export type { Ruleset } from './Ruleset.js'
export { RulesetSchema } from './Ruleset.js'
export type { RulesetSetting } from './RulesetSetting.js'
export { RulesetSettingSchema } from './RulesetSetting.js'
export type { Score } from './Score.js'
export { ScoreSchema } from './Score.js'
export type { Skin } from './Skin.js'
export { SkinSchema } from './Skin.js'

import { BeatmapSchema } from './Beatmap.js'
import { BeatmapCollectionSchema } from './BeatmapCollection.js'
import { BeatmapDifficultySchema } from './BeatmapDifficulty.js'
import { BeatmapMetadataSchema } from './BeatmapMetadata.js'
import { BeatmapSetSchema } from './BeatmapSet.js'
import { BeatmapUserSettingsSchema } from './BeatmapUserSettings.js'
import { FileSchema } from './RealmFile.js'
import { KeyBindingSchema } from './KeyBinding.js'
import { ModPresetSchema } from './ModPreset.js'
import { RealmNamedFileUsageSchema } from './RealmNamedFileUsage.js'
import { RealmUserSchema } from './RealmUser.js'
import { RulesetSchema } from './Ruleset.js'
import { RulesetSettingSchema } from './RulesetSetting.js'
import { ScoreSchema } from './Score.js'
import { SkinSchema } from './Skin.js'

export const Schema = [
  BeatmapSchema,
  BeatmapCollectionSchema,
  BeatmapDifficultySchema,
  BeatmapMetadataSchema,
  BeatmapSetSchema,
  BeatmapUserSettingsSchema,
  FileSchema,
  KeyBindingSchema,
  ModPresetSchema,
  RealmNamedFileUsageSchema,
  RealmUserSchema,
  RulesetSchema,
  RulesetSettingSchema,
  ScoreSchema,
  SkinSchema,
]
