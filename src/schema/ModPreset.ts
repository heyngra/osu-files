import type { ModPreset } from './types.js'

export type { ModPreset }
export type { ModPreset as default }

export const ModPresetSchema = {
  name: 'ModPreset',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    Ruleset: 'Ruleset',
    Name: 'string?',
    Description: 'string?',
    Mods: 'string?',
    DeletePending: 'bool',
  },
} as const
