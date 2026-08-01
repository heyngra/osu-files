/**
 * Public exports to hide from the API reference.
 *
 * Add any symbol name here to drop it from the API sidebar, catalog, and
 * generated pages. References to it in remaining pages are unlinked to plain
 * text automatically. A symbol is only worth excluding when nothing else
 * links to it from the guide (e.g. Realm schema internals, big constant
 * tables). Re-run `npm run docs:build` (or `docs:manifest` + `docs:excludes`)
 * after changing this list.
 */
export const apiExcludes: string[] = [
  // Realm schema table internals.
  'Schema',
  'BeatmapSchema',
  'BeatmapSetSchema',
  'BeatmapCollectionSchema',
  'BeatmapDifficultySchema',
  'BeatmapMetadataSchema',
  'BeatmapUserSettingsSchema',
  'FileSchema',
  'KeyBindingSchema',
  'ModPresetSchema',
  'RealmNamedFileUsageSchema',
  'RealmUserSchema',
  'RulesetSchema',
  'RulesetSettingSchema',
  'ScoreSchema',
  'SkinSchema',
  // Built-in skin plumbing.
  'BUILT_IN_SKINS',
  'BUILT_IN_SKIN_IDS',
  'BUILT_IN_SKIN_ORDER',
]
