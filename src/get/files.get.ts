import type Realm from 'realm'
import type { File } from '../schema/types.js'

export function createFileGetModule(realm: Realm) {
  return {
    all: (): File[] => [...realm.objects<File>('File')],
    byHash: (hash: string): File | undefined => realm.objectForPrimaryKey<File>('File', hash) ?? undefined,
  }
}
