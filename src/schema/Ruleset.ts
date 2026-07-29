export const RulesetSchema = {
  name: 'Ruleset',
  primaryKey: 'ShortName',
  properties: {
    ShortName: 'string?',
    OnlineID: { type: 'int', indexed: true },
    Name: 'string?',
    InstantiationInfo: 'string?',
    Available: 'bool',
    LastAppliedDifficultyVersion: 'int',
  },
} as const
