import Realm from 'realm'
import type { File } from '../schema/types.js'
import { EntityQuery } from './base.js'

export class FileQuery extends EntityQuery<File> {
  constructor(realm: Realm) { super(realm, 'File') }

  /** @example db.files.get.byHashEquals(hash)[0] */
  byHashEquals(v: string)  { return this._str('Hash', '==', v) }
}
