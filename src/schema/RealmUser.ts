import type { RealmUser } from './types.js'

export type { RealmUser }
export type { RealmUser as default }

export const RealmUserSchema = {
  name: 'RealmUser',
  embedded: true,
  properties: {
    OnlineID: 'int',
    Username: 'string?',
    CountryCode: 'string?',
  },
} as const
