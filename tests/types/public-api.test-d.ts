import type { OsuFilesAPI } from '../../src/index.js'
import { FileRef } from '../../src/types.js'

declare const db: OsuFilesAPI
declare const id: string

const skin = db.skins.get.byId(id)[0]
if (skin) {
  // @ts-expect-error readonly snapshot
  skin.Name = 'Changed'
  // @ts-expect-error readonly nested files
  skin.Files.push()
  // @ts-expect-error readonly file identity
  skin.Files[0].File!.Hash = 'fake'
}

for (const value of db.skins.get) {
  // @ts-expect-error iteration is readonly
  value.Name = 'Changed'
}

// @ts-expect-error live values are readonly
db.skins.get.live().byId(id)[0].Name = 'Changed'
// @ts-expect-error derived hash
db.skins.write.update(id, { Hash: 'fake' })
// @ts-expect-error protected file references
db.skins.write.update(id, { Files: [] })

const fileRef = new FileRef('file.osu', { hash: 'a'.repeat(64) })
// @ts-expect-error immutable FileRef
fileRef.hash = 'fake'

db.skins.write.update(id, { Name: 'Renamed' })
db.beatmaps.write.update(id, { Hidden: true })

using session = db.beatmaps.get.byHidden(false).autoEdit()
for (const beatmap of session)
  beatmap.Hidden = true

const mapped = db.skins.get.byNameContains('skin').map(value => value.Name)
const filtered = db.skins.get.filter(value => value.Protected)
const sliced = filtered.slice(0, 1)
void mapped
void sliced

await db.skins.open(id).getFile('button-left.png').edit(async content => content)
await db.scores.open(id).editReplay(async content => content)
