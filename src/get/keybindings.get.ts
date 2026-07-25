import type Realm from 'realm'
import type { KeyBinding } from '../schema/types.js'

/**
 * Creates keybinding query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query keybindings by id or ruleset.
 * @example
 * const binds = createKeyBindingGetModule(realm).byRuleset('osu')
 */
export function createKeyBindingGetModule(realm: Realm) {
  return {
    all: (): KeyBinding[] => [...realm.objects<KeyBinding>('KeyBinding')],
    byId: (id: string): KeyBinding | undefined => realm.objectForPrimaryKey<KeyBinding>('KeyBinding', id) ?? undefined,
    byRuleset: (name: string): KeyBinding[] => [...realm.objects<KeyBinding>('KeyBinding').filtered('RulesetName == $0', name)],
  }
}
