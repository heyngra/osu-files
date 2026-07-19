import type Realm from 'realm'
import type { Ruleset } from '../schema/types.js'

export function createRulesetGetModule(realm: Realm) {
  return {
    all: (): Ruleset[] => [...realm.objects<Ruleset>('Ruleset')],
    available: (): Ruleset[] => [...realm.objects<Ruleset>('Ruleset').filtered('Available == true')],
    byShortName: (name: string): Ruleset | undefined => realm.objectForPrimaryKey<Ruleset>('Ruleset', name) ?? undefined,
    byOnlineId: (id: number): Ruleset | undefined => realm.objects<Ruleset>('Ruleset').filtered('OnlineID == $0', id)[0] ?? undefined,
  }
}
