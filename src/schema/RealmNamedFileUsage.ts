export const RealmNamedFileUsageSchema = {
  name: 'RealmNamedFileUsage',
  embedded: true,
  properties: {
    File: 'File',
    Filename: 'string?',
  },
} as const
