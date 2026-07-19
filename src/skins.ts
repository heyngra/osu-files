import type Realm from 'realm'
import type { Skin } from './schema/types.js'

export function createSkinModule(realm: Realm) {
  return {
    get: {
      all: (): Skin[] => [...realm.objects<Skin>('Skin')],
      byId: (id: string): Skin | undefined => realm.objectForPrimaryKey<Skin>('Skin', id) ?? undefined,
      byName: (name: string): Skin[] => [...realm.objects<Skin>('Skin').filtered('Name CONTAINS[c] $0', name)],
    },
  }
}
