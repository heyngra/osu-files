import type Realm from 'realm'
import type { File } from './schema/types.js'

export function createFileModule(realm: Realm) {
  return {
    get: {
      all: (): File[] => [...realm.objects<File>('File')],
      byHash: (hash: string): File | undefined => realm.objectForPrimaryKey<File>('File', hash) ?? undefined,
    },
  }
}
