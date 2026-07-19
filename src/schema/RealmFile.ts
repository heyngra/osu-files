import type { File, RealmFile } from './types.js'

export type { File, RealmFile }
export type { File as default }

export const FileSchema = {
  name: 'File',
  primaryKey: 'Hash',
  properties: {
    Hash: 'string?',
  },
} as const
