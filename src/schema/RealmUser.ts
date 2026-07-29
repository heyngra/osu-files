export const RealmUserSchema = {
  name: 'RealmUser',
  embedded: true,
  properties: {
    OnlineID: 'int',
    Username: 'string?',
    CountryCode: 'string?',
  },
} as const
