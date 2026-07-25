import type Realm from 'realm'
import type { File } from '../schema/types.js'

/**
 * Creates file query helpers.
 * @param realm - The Realm instance.
 * @returns An object with methods to query files by hash.
 * @example
 * const file = createFileGetModule(realm).byHash('d41d8cd98f00b204e9800998ecf8427e')
 */
export function createFileGetModule(realm: Realm) {
  return {
    all: (): File[] => [...realm.objects<File>('File')],
    byHash: (hash: string): File | undefined => realm.objectForPrimaryKey<File>('File', hash) ?? undefined,
  }
}
