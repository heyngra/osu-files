export const RulesetSettingSchema = {
  name: 'RulesetSetting',
  properties: {
    RulesetName: { type: 'string', indexed: true, optional: true },
    Variant: { type: 'int', indexed: true },
    Key: 'string',
    Value: 'string',
  },
} as const
