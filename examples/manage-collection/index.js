/** @satisfies {import('../../tools/docs/guide-schema.js').GuideMetadata} */
const guide = {
  group: 'collections',
  title: 'Manage a collection',
  order: 30,
  summary: 'Adds beatmaps to a collection by online ID and removes them by list index.',
  api: ['init', 'OsuFilesAPI.collections', 'OsuFilesAPI.beatmaps'],
}
import readline from 'node:readline/promises'
import init from 'osu-files'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function buildMd5Map(osu) {
  const map = {}
  for (const b of osu.beatmaps.get) {
    if (b.MD5Hash) map[b.MD5Hash] = b
  }
  return map
}

;(async () => {
  const osuLazerRealmPath = (await rl.question('What is the path of osu!lazer client.realm? ')).replace(/^["']|["']$/g, '')

  const osu = init(osuLazerRealmPath, { readOnly: false })

  try {
    while (true) {
      const all = osu.collections.get
      if (all.length === 0) {
        console.log('No collections found.')
        return
      }

      console.log(`\nCollections (${all.length}):`)
      for (const c of all)
        console.log(`  ${c.Name ?? '(unnamed)'} - ${c.BeatmapMD5Hashes.filter(h => h).length} beatmaps`)

      const name = (await rl.question('\nCollection name (or empty to quit): ')).trim()
      if (!name) break

      /**
       * @docs
       * Collection queries return detached snapshots. Changes go through the collection module rather than mutating `col`.
       */
      /* @docs:start find-collection */
      const col = osu.collections.get.byName(name).first()
      if (!col) { console.log(`'${name}' not found.`); continue }
      /* @docs:end find-collection */

      const md5map = buildMd5Map(osu)
      const hashes = col.BeatmapMD5Hashes.filter(h => h)

      while (true) {
        console.log(`\nCollection: ${col.Name}`)
        console.log(`Beatmaps: ${hashes.length}`)

        if (hashes.length === 0) {
          console.log('  (empty)')
        } else {
          for (let i = 0; i < hashes.length; i++) {
            const bm = md5map[hashes[i]]
            const label = bm ? `${bm.OnlineID} ${bm.DifficultyName ?? '?'}` : `${hashes[i].slice(0, 8)}...`
            console.log(`  [${i}] ${label}`)
          }
        }

        const action = (await rl.question('\n(a)dd by OnlineID, (r)emove by index, (q)uit: ')).trim().toLowerCase()
        if (action === 'q') break

        if (action === 'a') {
          const onlineId = parseInt((await rl.question('Enter beatmap OnlineID: ')).trim())
          if (isNaN(onlineId)) { console.log('Invalid OnlineID.'); continue }

          /**
           * @docs
           * Collections store beatmap MD5 hashes, not online IDs. Look up the beatmap first, then add its MD5 hash to the selected collection.
           */
          /* @docs:start add-beatmap */
          const beatmap = osu.beatmaps.get.byOnlineId(onlineId).first()
          if (!beatmap) { console.log(`Beatmap ${onlineId} not found.`); continue }
          if (!beatmap.MD5Hash) { console.log(`Beatmap ${onlineId} has no MD5Hash.`); continue }

          osu.collections.addBeatmap(String(col.ID), beatmap.MD5Hash)
          /* @docs:end add-beatmap */
          hashes.push(beatmap.MD5Hash)
          md5map[beatmap.MD5Hash] = beatmap
          console.log(`  Added: ${beatmap.OnlineID} ${beatmap.DifficultyName ?? '?'}`)
        }

        if (action === 'r') {
          const idx = parseInt((await rl.question(`Enter index (0-${hashes.length - 1}): `)).trim())
          if (isNaN(idx) || idx < 0 || idx >= hashes.length) { console.log('Invalid index.'); continue }

          const md5 = hashes[idx]
          const bm = md5map[md5]
          const label = bm ? `${bm.OnlineID} ${bm.DifficultyName ?? '?'}` : `${md5.slice(0, 8)}...`

          /**
           * @docs
           * Removal uses the same MD5 hash. The local array is updated as well so the next prompt reflects the change without another query.
           */
          /* @docs:start remove-beatmap */
          osu.collections.removeBeatmap(String(col.ID), md5)
          hashes.splice(idx, 1)
          /* @docs:end remove-beatmap */
          console.log(`  Removed: ${label}`)
        }
      }
    }
  } finally {
    osu.close()
    rl.close()
    process.exit(0)
  }
})()
