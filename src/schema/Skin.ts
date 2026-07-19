import type { Skin } from './types.js'

export type { Skin }
export type { Skin as default }

export const SkinSchema = {
  name: 'Skin',
  primaryKey: 'ID',
  properties: {
    ID: 'uuid',
    Name: 'string?',
    Creator: 'string?',
    InstantiationInfo: 'string?',
    Hash: 'string?',
    Protected: 'bool',
    Files: 'RealmNamedFileUsage[]',
    DeletePending: 'bool',
  },
} as const
