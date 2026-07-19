import type Realm from 'realm'
import type { KeyBinding } from './schema/types.js'

export function createKeyBindingModule(realm: Realm) {
  return {
    get: {
      all: (): KeyBinding[] => [...realm.objects<KeyBinding>('KeyBinding')],
      byId: (id: string): KeyBinding | undefined => realm.objectForPrimaryKey<KeyBinding>('KeyBinding', id) ?? undefined,
      byRuleset: (name: string): KeyBinding[] => [...realm.objects<KeyBinding>('KeyBinding').filtered('RulesetName == $0', name)],
    },
  }
}
