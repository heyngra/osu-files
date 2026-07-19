import type { KeyBinding } from './types.js'

export type { KeyBinding }
export type { KeyBinding as default }

export const KeyBindingSchema = {
  name: 'KeyBinding',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    RulesetName: 'string?',
    Variant: 'int?',
    Action: 'int',
    KeyCombination: 'string?',
  },
} as const
