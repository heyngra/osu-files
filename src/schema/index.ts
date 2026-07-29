export { BeatmapSchema } from './Beatmap.js'
export { BeatmapCollectionSchema } from './BeatmapCollection.js'
export { BeatmapDifficultySchema } from './BeatmapDifficulty.js'
export { BeatmapMetadataSchema } from './BeatmapMetadata.js'
export { BeatmapSetSchema } from './BeatmapSet.js'
export { BeatmapUserSettingsSchema } from './BeatmapUserSettings.js'
export { FileSchema } from './RealmFile.js'
export { KeyBindingSchema } from './KeyBinding.js'
export { ModPresetSchema } from './ModPreset.js'
export { RealmNamedFileUsageSchema } from './RealmNamedFileUsage.js'
export { RealmUserSchema } from './RealmUser.js'
export { RulesetSchema } from './Ruleset.js'
export { RulesetSettingSchema } from './RulesetSetting.js'
export { ScoreSchema } from './Score.js'
export { SkinSchema } from './Skin.js'

export type {
  Beatmap,
  BeatmapCollection,
  BeatmapDifficulty,
  BeatmapMetadata,
  BeatmapSet,
  BeatmapUserSettings,
  File,
  KeyBinding,
  ModPreset,
  RealmNamedFileUsage,
  RealmUser,
  Ruleset,
  RulesetSetting,
  Score,
  Skin,
} from './types.js'

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
