export const facadeDefinitions = [
  { name: 'Beatmaps', path: 'db.beatmaps.get', sortField: 'BPM', patch: '{ Hidden: true }', noun: 'beatmaps', description: 'Find and edit beatmap snapshots.' },
  { name: 'Sets', path: 'db.sets.get', sortField: 'DateAdded', patch: '{ Status: 1 }', noun: 'beatmap sets', description: 'Find beatmap sets and their files.' },
  { name: 'Scores', path: 'db.scores.get', sortField: 'Date', patch: '{ PP: 0 }', noun: 'scores', description: 'Find scores by player, date, or beatmap.' },
  { name: 'Collections', path: 'db.collections.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'collections', description: 'Find named beatmap collections.' },
  { name: 'Rulesets', path: 'db.rulesets.get', sortField: 'Name', patch: '{ Available: true }', noun: 'rulesets', description: 'Find installed rulesets.' },
  { name: 'RulesetSettings', path: 'db.rulesetSettings.get', sortField: 'Key', patch: "{ Value: 'Example' }", noun: 'ruleset settings', description: 'Read settings for each ruleset.' },
  { name: 'Skins', path: 'db.skins.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'skins', description: 'Find built-in and user skins.' },
  { name: 'Files', path: 'db.files.get', sortField: 'Hash', patch: null, noun: 'files', description: 'Find file records by hash.' },
  { name: 'Keybindings', path: 'db.keybindings.get', sortField: 'Action', patch: "{ KeyCombination: 'Z' }", noun: 'keybindings', description: 'Find key bindings.' },
  { name: 'ModPresets', path: 'db.modpresets.get', sortField: 'Name', patch: "{ Name: 'Example' }", noun: 'mod presets', description: 'Find saved mod presets.' },
  { name: 'Metadata', path: 'db.metadata.get', sortField: 'Title', patch: "{ Title: 'Example' }", noun: 'metadata records', description: 'Search embedded beatmap metadata.' },
] as const

export const facadeNames = facadeDefinitions.map(facade => facade.name)

export const writableFacades = new Set([
  'Beatmaps', 'Sets', 'Scores', 'Collections', 'Rulesets', 'Skins', 'Files', 'Keybindings', 'ModPresets',
])
