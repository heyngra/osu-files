import { describe, it } from 'node:test'
import assert from 'node:assert'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Realm from 'realm'
import { EditSession } from '../src/index.js'

const schema: Realm.ObjectSchema[] = [
  {
    name: 'EditUser',
    embedded: true,
    properties: { Username: 'string' },
  },
  {
    name: 'EditThing',
    primaryKey: 'ID',
    properties: { ID: 'int', Name: 'string', User: 'EditUser' },
  },
]

describe('EditSession', () => {
  it('commits direct and nested edits with using', () => {
    const realm = new Realm({ path: join(tmpdir(), `osu-files-edit-session-${process.pid}-commit`), schema })
    realm.write(() => realm.create('EditThing', { ID: 1, Name: 'old', User: { Username: 'old-user' } }))

    {
      using session = new EditSession(realm, [...realm.objects('EditThing')])
      for (const thing of session) {
        thing.Name = 'new'
        thing.User.Username = 'new-user'
      }
    }

    const thing = realm.objectForPrimaryKey<any>('EditThing', 1)!
    assert.strictEqual(thing.Name, 'new')
    assert.strictEqual(thing.User.Username, 'new-user')
    realm.close()
  })

  it('discards edits on rollback', () => {
    const realm = new Realm({ path: join(tmpdir(), `osu-files-edit-session-${process.pid}-rollback`), schema })
    realm.write(() => realm.create('EditThing', { ID: 1, Name: 'old', User: { Username: 'old-user' } }))
    const session = new EditSession(realm, [...realm.objects('EditThing')])
    session.at(0)!.Name = 'discarded'
    session.rollback()

    assert.strictEqual(realm.objectForPrimaryKey<any>('EditThing', 1)!.Name, 'old')
    realm.close()
  })
})
