import Realm from 'realm'
import type { Skin } from '../schema/types.js'
import { BUILT_IN_SKIN_IDS, BUILT_IN_SKIN_ORDER } from '../skin/constants.js'

/**
 * Creates skin query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query skins by id, name, creator, hash, and built-in or usable subsets.
 * @example
 * const skins = createSkinGetModule(realm).usable()
 */
export function createSkinGetModule(realm: Realm) {
  return {
    all: (): Skin[] => [...realm.objects<Skin>('Skin')],
    byId: (id: string): Skin | undefined => realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(id)) ?? undefined,
    byName: (name: string): Skin[] => [...realm.objects<Skin>('Skin').filtered('Name CONTAINS[c] $0', name)],

    usable: (): Skin[] => {
      const builtInMap = new Map<string, Skin>()
      for (const id of BUILT_IN_SKIN_IDS) {
        const s = realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(id))
        if (s) builtInMap.set(id, s)
      }
      const builtIn: Skin[] = []
      for (const id of BUILT_IN_SKIN_ORDER) {
        const s = builtInMap.get(id)
        if (s) builtIn.push(s)
      }
      const user = [...realm.objects<Skin>('Skin')
        .filtered('DeletePending == false AND Protected == false')
        .sorted('Name', false)]
        .filter(s => !BUILT_IN_SKIN_IDS.includes(String(s.ID)))

      return [...builtIn, ...user]
    },

    builtIn: (): Skin[] => {
      const result: Skin[] = []
      for (const id of BUILT_IN_SKIN_ORDER) {
        const s = realm.objectForPrimaryKey<Skin>('Skin', new Realm.BSON.UUID(id))
        if (s) result.push(s)
      }
      return result
    },

    byCreator: (name: string): Skin[] => [...realm.objects<Skin>('Skin').filtered('Creator CONTAINS[c] $0', name)],

    byHash: (hash: string): Skin[] => [...realm.objects<Skin>('Skin').filtered('Hash == $0', hash)],

    withFile: (filename: string): Skin[] => [...realm.objects<Skin>('Skin').filtered('ANY Files.Filename == $0', filename)],
  }
}
