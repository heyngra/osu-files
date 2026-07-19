import type Realm from 'realm'
import type { ModPreset } from '../schema/types.js'

export function createModPresetGetModule(realm: Realm) {
  return {
    all: (): ModPreset[] => [...realm.objects<ModPreset>('ModPreset')],
    byId: (id: string): ModPreset | undefined => realm.objectForPrimaryKey<ModPreset>('ModPreset', id) ?? undefined,
    byRuleset: (shortName: string): ModPreset[] => [...realm.objects<ModPreset>('ModPreset').filtered('Ruleset.ShortName == $0', shortName)],
  }
}
