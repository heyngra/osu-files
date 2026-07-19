import type { Ruleset } from './types.js'

export type { Ruleset }
export type { Ruleset as default }

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
