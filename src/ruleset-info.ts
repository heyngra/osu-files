export const RULESETS = [
  { shortName: 'osu',    mode: 0, onlineID: 0,  name: 'osu!',      variantCount: 1 },
  { shortName: 'taiko',  mode: 1, onlineID: 1,  name: 'osu!taiko',  variantCount: 1 },
  { shortName: 'fruits', mode: 2, onlineID: 2,  name: 'osu!catch',  variantCount: 1 },
  { shortName: 'mania',  mode: 3, onlineID: 3,  name: 'osu!mania',  variantCount: 10 },
] as const

export const MODE_TO_SHORTNAME: Record<number, string> = Object.fromEntries(RULESETS.map(r => [r.mode, r.shortName]))
export const SHORTNAME_TO_MODE: Record<string, number> = Object.fromEntries(RULESETS.map(r => [r.shortName, r.mode]))

export const RULESET_INSTANTIATION: Record<string, string> = {
  osu:    'osu.Game.Rulesets.Osu.OsuRuleset, osu.Game.Rulesets.Osu',
  taiko:  'osu.Game.Rulesets.Taiko.TaikoRuleset, osu.Game.Rulesets.Taiko',
  fruits: 'osu.Game.Rulesets.Catch.CatchRuleset, osu.Game.Rulesets.Catch',
  mania:  'osu.Game.Rulesets.Mania.ManiaRuleset, osu.Game.Rulesets.Mania',
}
