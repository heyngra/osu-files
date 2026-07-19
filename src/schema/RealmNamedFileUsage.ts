import type { RealmNamedFileUsage } from './types.js'

export type { RealmNamedFileUsage }
export type { RealmNamedFileUsage as default }

export const RealmNamedFileUsageSchema = {
  name: 'RealmNamedFileUsage',
  embedded: true,
  properties: {
    File: 'File',
    Filename: 'string?',
  },
} as const
