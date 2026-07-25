import type Realm from 'realm'
import type { Ruleset } from '../schema/types.js'

/**
 * Creates ruleset query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query rulesets by short name, online id, or availability.
 * @example
 * const osu = createRulesetGetModule(realm).byShortName('osu')
 */
export function createRulesetGetModule(realm: Realm) {
  return {
    all: (): Ruleset[] => [...realm.objects<Ruleset>('Ruleset')],
    available: (): Ruleset[] => [...realm.objects<Ruleset>('Ruleset').filtered('Available == true')],
    byShortName: (name: string): Ruleset | undefined => realm.objectForPrimaryKey<Ruleset>('Ruleset', name) ?? undefined,
    byOnlineId: (id: number): Ruleset | undefined => realm.objects<Ruleset>('Ruleset').filtered('OnlineID == $0', id)[0] ?? undefined,
  }
}
