import type Realm from 'realm'
import type { ModPreset } from '../schema/types.js'

/**
 * Creates mod preset query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query mod presets by id or ruleset.
 * @example
 * const presets = createModPresetGetModule(realm).byRuleset('osu')
 */
export function createModPresetGetModule(realm: Realm) {
  return {
    all: (): ModPreset[] => [...realm.objects<ModPreset>('ModPreset')],
    byId: (id: string): ModPreset | undefined => realm.objectForPrimaryKey<ModPreset>('ModPreset', id) ?? undefined,
    byRuleset: (shortName: string): ModPreset[] => [...realm.objects<ModPreset>('ModPreset').filtered('Ruleset.ShortName == $0', shortName)],
  }
}
